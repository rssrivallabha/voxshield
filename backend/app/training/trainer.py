import os
import json
import time
import uuid
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset, random_split
import numpy as np
from ..inference.rawnet2.model import RawNet2Model
from ..db import get_conn, DB_PATH

_RAWNET2_CONFIG = {
    "sinc_filters": 128,
    "sinc_filter_length": 129,
    "sample_rate": 16000,
    "sinc_scale": "linear",
    "learnable_sinc": False,
    "first_block_channels": 128,
    "second_block_channels": 512,
    "num_first_blocks": 2,
    "num_second_blocks": 4,
    "gru_hidden": 1024,
    "embedding_dim": 1024,
    "class_weights": [8.837, 1.0],
}

def _load_audio(path: str):
    import torchaudio
    waveform, sr = torchaudio.load(path)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != 16000:
        waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)
    # ensure 64000 samples
    if waveform.shape[1] < 64000:
        pad = torch.zeros(1, 64000 - waveform.shape[1])
        waveform = torch.cat([waveform, pad], dim=1)
    else:
        waveform = waveform[:, :64000]
    return waveform.squeeze(0)  # (64000,)

def train_job(job_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM training_jobs WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            return
        config = json.loads(row["config_json"])
        dataset_version = row["dataset_version"]
        parent_version = row["parent_model_version"]
        created_by = row["created_by"]

    # fetch samples
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT sample_id, admin_label, stored_path FROM dataset_samples WHERE dataset_version=? AND preprocessing_status='COMPLETED'",
            (dataset_version,)
        ).fetchall()

    if len(rows) < 10:
        _fail_job(job_id, "Insufficient samples")
        return

    # prepare tensors
    X = []
    y = []
    for r in rows:
        label = 0 if r["admin_label"] == "AI" else 1  # AI=spoof class 0, HUMAN=bonafide class1
        waveform = _load_audio(r["stored_path"])
        X.append(waveform)
        y.append(label)

    X = torch.stack(X)  # (N, 64000)
    y = torch.tensor(y, dtype=torch.long)

    # deterministic split
    generator = torch.Generator().manual_seed(config.get("seed", 42))
    n_val = max(1, int(0.2 * len(X)))
    n_train = len(X) - n_val
    train_ds, val_ds = random_split(TensorDataset(X, y), [n_train, n_val], generator=generator)

    train_loader = DataLoader(train_ds, batch_size=config.get("batch_size", 16), shuffle=True, generator=generator)
    val_loader = DataLoader(val_ds, batch_size=config.get("batch_size", 16), shuffle=False)

    # model
    model = RawNet2Model(_RAWNET2_CONFIG)
    # load parent weights if exists
    if parent_version:
        with get_conn() as conn:
            prow = conn.execute("SELECT artifact_path FROM model_versions WHERE version_id=?", (parent_version,)).fetchone()
            if prow and os.path.exists(prow["artifact_path"]):
                ckpt = torch.load(prow["artifact_path"], map_location="cpu")
                model.load_state_dict(ckpt["model_state_dict"], strict=True)

    device = torch.device("cpu")
    model.to(device)
    class_weights = torch.tensor(_RAWNET2_CONFIG["class_weights"], dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.AdamW(model.parameters(), lr=config.get("lr", 1e-4), weight_decay=config.get("weight_decay", 1e-5))

    epochs = config.get("epochs", 5)
    for epoch in range(epochs):
        model.train()
        for xb, yb in train_loader:
            xb = xb.unsqueeze(1).to(device)  # add channel dim? model expects dict with waveform key
            yb = yb.to(device)
            optimizer.zero_grad()
            out = model({"waveform": xb})
            logits = out["logits"]
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()

    # validation
    model.eval()
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for xb, yb in val_loader:
            xb = xb.unsqueeze(1).to(device)
            out = model({"waveform": xb})
            logits = out["logits"]
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(yb.numpy())

    # compute metrics without sklearn if unavailable
    try:
        from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
        acc = accuracy_score(all_labels, all_preds)
        precision, recall, f1, _ = precision_recall_fscore_support(all_labels, all_preds, average='binary', pos_label=0)
        cm = confusion_matrix(all_labels, all_preds, labels=[0,1]).tolist()
    except Exception:
        # fallback simple calculations
        import numpy as np
        all_labels_np = np.array(all_labels)
        all_preds_np = np.array(all_preds)
        acc = float((all_labels_np == all_preds_np).mean())
        # binary metrics for class 0
        tp = int(((all_labels_np == 0) & (all_preds_np == 0)).sum())
        fp = int(((all_labels_np != 0) & (all_preds_np == 0)).sum())
        fn = int(((all_labels_np == 0) & (all_preds_np != 0)).sum())
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        cm = [[int(((all_labels_np == 0) & (all_preds_np == 0)).sum()), int(((all_labels_np == 0) & (all_preds_np == 1)).sum())],
              [int(((all_labels_np == 1) & (all_preds_np == 0)).sum()), int(((all_labels_np == 1) & (all_preds_np == 1)).sum())]]

    per_class = {}
    import numpy as np
    for cls, name in [(0,"AI"), (1,"HUMAN")]:
        mask = np.array(all_labels)==cls
        if mask.sum()>0:
            per_class[name] = {
                "count": int(mask.sum()),
                "avg_score": float(np.mean([p for p,l in zip(all_preds, all_labels) if l==cls]))
            }
        else:
            per_class[name] = {"count":0, "avg_score":0.0}

    metrics = {
        "accuracy": acc,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusion_matrix": cm,
        "per_class": per_class,
        "train_samples": n_train,
        "val_samples": n_val,
    }

    # save artifact
    base_dir = os.path.join(os.path.dirname(DB_PATH), "..", "backend", "models", "synthetic_speech", "versions")
    version_dir = os.path.normpath(base_dir)
    os.makedirs(version_dir, exist_ok=True)
    # determine next version number
    existing = [d for d in os.listdir(version_dir) if d.startswith("rawnet2-v")]
    nums = [int(d.split("-v")[1]) for d in existing if "-v" in d]
    next_num = max(nums) + 1 if nums else 1
    version_id = f"rawnet2-v{next_num}"
    artifact_dir = os.path.join(version_dir, version_id)
    os.makedirs(artifact_dir, exist_ok=True)
    artifact_path = os.path.join(artifact_dir, "best.pt")
    torch.save({
        "model_state_dict": model.state_dict(),
        "config": _RAWNET2_CONFIG,
    }, artifact_path)

    # update training_jobs
    with get_conn() as conn:
        conn.execute(
            "UPDATE training_jobs SET status='VALIDATED', completed_at=?, metrics_json=?, artifact_path=? WHERE job_id=?",
            (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), json.dumps(metrics), artifact_path, job_id)
        )
        conn.commit()

    # insert model_versions
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO model_versions
            (version_id, parent_version_id, training_job_id, artifact_path, metrics_json, approval_state, deployed, created_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (version_id, parent_version, job_id, artifact_path, json.dumps(metrics), "PENDING", 0,
             time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()))
        )
        conn.commit()

def _fail_job(job_id: str, reason: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE training_jobs SET status='FAILED', completed_at=?, metrics_json=? WHERE job_id=?",
            (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), json.dumps({"error": reason}), job_id)
        )
        conn.commit()