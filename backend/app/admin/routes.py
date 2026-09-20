<<<<<<< ours
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uuid, time, os, json, shutil, threading
import sqlite3
from ..db import get_conn, DB_PATH
from ..auth import require_admin
from ..inference.ml_adapters import RawNet2SyntheticDetector
import torch
from ..training.trainer import train_job

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# ---------- Dataset Samples ----------
class SampleResponse(BaseModel):
    sample_id: str
    original_filename: str
    generated_reference_name: str
    custom_display_name: Optional[str]
    admin_label: str
    model_prediction: Optional[str]
    model_version_used_for_inference: Optional[str]
    raw_synthetic_probability: Optional[float]
    uploader_id: str
    uploaded_at: str
    duration_sec: float
    sample_rate: int
    channels: int
    preprocessing_status: str
    dataset_version: int
    included_in_training: int
    production_identity_id: Optional[str]

@router.post("/samples/upload", response_model=SampleResponse)
async def upload_sample(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    admin_label: str = Form(...),  # HUMAN or AI
    custom_display_name: Optional[str] = Form(None),
    user: dict = Depends(require_admin),
):
    import torchaudio
    if admin_label not in ("HUMAN", "AI"):
        raise HTTPException(400, "admin_label must be HUMAN or AI")
    # validate audio
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large")
    # save to temp
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".wav", ".flac", ".ogg", ".mp3"):
        raise HTTPException(400, "Unsupported audio format")
    sample_id = f"smp_{uuid.uuid4().hex[:12]}"
    storage_dir = os.path.join(os.path.dirname(DB_PATH), "samples")
    os.makedirs(storage_dir, exist_ok=True)
    stored_path = os.path.join(storage_dir, f"{sample_id}{ext}")
    with open(stored_path, "wb") as f:
        f.write(contents)
    # probe metadata
    try:
        info = torchaudio.info(stored_path)
        duration = info.num_frames / info.sample_rate
        sample_rate = info.sample_rate
        channels = info.num_channels
    except Exception as e:
        os.remove(stored_path)
        raise HTTPException(400, f"Invalid audio file: {e}")

    # generate reference name
    namespace = "AI_VOICE" if admin_label == "AI" else "HUMAN_VOICE"
    with get_conn() as conn:
        cur = conn.execute("SELECT next_number FROM naming_counters WHERE namespace=?", (namespace,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(500, "Naming counter missing")
        next_num = row["next_number"]
        conn.execute("UPDATE naming_counters SET next_number=? WHERE namespace=?", (next_num + 1, namespace))
        generated_name = f"{'AI' if admin_label=='AI' else 'HUMAN'} VOICE {next_num}"
        conn.commit()

    # run inference to get model prediction and raw probability
    detector = RawNet2SyntheticDetector()
    # load audio mono 16k
    waveform, sr = torchaudio.load(stored_path)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != 16000:
        waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)
        sr = 16000
    # ensure 64000 samples
    if waveform.shape[1] < 64000:
        # pad
        pad = torch.zeros(1, 64000 - waveform.shape[1])
        waveform = torch.cat([waveform, pad], dim=1)
    else:
        waveform = waveform[:, :64000]
    with torch.no_grad():
        logits = detector.model(waveform)
        prob = torch.softmax(logits, dim=1)[0, 0].item()  # class 0 = spoof
    model_version = detector.model_id
    model_pred = "AI" if prob > 0.5 else "HUMAN"

    uploaded_at = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO dataset_samples
            (sample_id, original_filename, generated_reference_name, custom_display_name,
             admin_label, model_prediction, model_version_used_for_inference,
             raw_synthetic_probability, uploader_id, uploaded_at, duration_sec,
             sample_rate, channels, preprocessing_status, dataset_version, stored_path)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (sample_id, file.filename, generated_name, custom_display_name,
             admin_label, model_pred, model_version, prob, user["id"], uploaded_at,
             duration, sr, channels, "COMPLETED", 1, stored_path),
        )
        conn.commit()
    return SampleResponse(
        sample_id=sample_id,
        original_filename=file.filename,
        generated_reference_name=generated_name,
        custom_display_name=custom_display_name,
        admin_label=admin_label,
        model_prediction=model_pred,
        model_version_used_for_inference=model_version,
        raw_synthetic_probability=prob,
        uploader_id=user["id"],
        uploaded_at=uploaded_at,
        duration_sec=duration,
        sample_rate=sr,
        channels=channels,
        preprocessing_status="COMPLETED",
        dataset_version=1,
        included_in_training=0,
        production_identity_id=None,
    )

@router.get("/samples", response_model=List[SampleResponse])
def list_samples(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM dataset_samples ORDER BY uploaded_at DESC").fetchall()
    return [SampleResponse(**dict(r)) for r in rows]

@router.get("/samples/{sample_id}", response_model=SampleResponse)
def get_sample(sample_id: str, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM dataset_samples WHERE sample_id=?", (sample_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Sample not found")
    return SampleResponse(**dict(row))

# ---------- Training Jobs ----------
class TrainRequest(BaseModel):
    dataset_version: int = 1
    epochs: int = 5
    batch_size: int = 16
    lr: float = 1e-4
    weight_decay: float = 1e-5
    seed: int = 42

class TrainingJobResponse(BaseModel):
    job_id: str
    dataset_version: int
    parent_model_version: Optional[str]
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    config_json: str
    metrics_json: Optional[str]
    artifact_path: Optional[str]
    created_by: str

def _train_background(job_id: str, config: dict, user_id: str):
    # mark running
    with get_conn() as conn:
        conn.execute("UPDATE training_jobs SET status='RUNNING', started_at=? WHERE job_id=?",
                     (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), job_id))
        conn.commit()
    # actual training runs in separate thread to avoid blocking event loop
    threading.Thread(target=train_job, args=(job_id,), daemon=True).start()

@router.post("/training/start", response_model=TrainingJobResponse)
def start_training(req: TrainRequest, background_tasks: BackgroundTasks, user: dict = Depends(require_admin)):
    job_id = f"trn_{uuid.uuid4().hex[:12]}"
    config = req.dict()
    parent_version = None
    with get_conn() as conn:
        row = conn.execute("SELECT version_id FROM model_versions WHERE deployed=1 ORDER BY deployed_at DESC LIMIT 1").fetchone()
        if row:
            parent_version = row["version_id"]
        conn.execute(
            "INSERT INTO training_jobs (job_id, dataset_version, parent_model_version, status, config_json, created_by) VALUES (?,?,?,?,?,?)",
            (job_id, req.dataset_version, parent_version, "QUEUED", json.dumps(config), user["id"])
        )
        conn.commit()
    background_tasks.add_task(_train_background, job_id, config, user["id"])
    return TrainingJobResponse(job_id=job_id, dataset_version=req.dataset_version, parent_model_version=parent_version,
                               status="QUEUED", started_at=None, completed_at=None, config_json=json.dumps(config),
                               metrics_json=None, artifact_path=None, created_by=user["id"])

@router.get("/training/jobs", response_model=List[TrainingJobResponse])
def list_training_jobs(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM training_jobs ORDER BY created_at DESC").fetchall()
    return [TrainingJobResponse(**dict(r)) for r in rows]

# ---------- Model Versions ----------
class ModelVersionResponse(BaseModel):
    version_id: str
    parent_version_id: Optional[str]
    training_job_id: str
    artifact_path: str
    metrics_json: str
    approval_state: str
    deployed: int
    created_at: str
    approved_at: Optional[str]
    deployed_at: Optional[str]

@router.get("/models", response_model=List[ModelVersionResponse])
def list_models(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM model_versions ORDER BY created_at DESC").fetchall()
    return [ModelVersionResponse(**dict(r)) for r in rows]

@router.post("/models/{version_id}/approve")
def approve_model(version_id: str, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM model_versions WHERE version_id=?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Model version not found")
        conn.execute(
            "UPDATE model_versions SET approval_state='APPROVED', approved_at=? WHERE version_id=?",
            (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), version_id)
        )
        conn.commit()
    return {"status": "approved"}

@router.post("/models/{version_id}/deploy")
def deploy_model(version_id: str, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM model_versions WHERE version_id=?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Model version not found")
        if row["approval_state"] != "APPROVED":
            raise HTTPException(400, "Model not approved")
        # undeploy current
        conn.execute("UPDATE model_versions SET deployed=0 WHERE deployed=1")
        conn.execute(
            "UPDATE model_versions SET deployed=1, deployed_at=? WHERE version_id=?",
            (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), version_id)
        )
        conn.commit()
    # reload synthetic detector with new artifact
    artifact_path = row["artifact_path"]
    if artifact_path and os.path.exists(artifact_path):
        new_detector = RawNet2SyntheticDetector(model_path=artifact_path)
        # replace global detector
        import sys
        main_mod = sys.modules.get('app.main')
        if main_mod:
            main_mod.synthetic_detector = new_detector
    return {"status": "deployed"}

@router.post("/models/{version_id}/rollback")
def rollback_model(version_id: str, user: dict = Depends(require_admin)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM model_versions WHERE version_id=?", (version_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Model version not found")
        if row["approval_state"] != "APPROVED":
            raise HTTPException(400, "Can only rollback to approved version")
        conn.execute("UPDATE model_versions SET deployed=0 WHERE deployed=1")
        conn.execute(
            "UPDATE model_versions SET deployed=1, deployed_at=? WHERE version_id=?",
            (time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), version_id)
        )
        conn.commit()
    # reload synthetic detector with rolled-back artifact
    artifact_path = row["artifact_path"]
    if artifact_path and os.path.exists(artifact_path):
        new_detector = RawNet2SyntheticDetector(model_path=artifact_path)
        import sys
        main_mod = sys.modules.get('app.main')
        if main_mod:
            main_mod.synthetic_detector = new_detector
    return {"status": "rolled_back"}

# ---------- Dashboard Stats ----------
class DashboardStats(BaseModel):
    dataset_human_count: int
    dataset_ai_count: int
    dataset_total_duration_sec: float
    training_jobs_total: int
    current_deployed_version: Optional[str]
    model_versions_total: int
    latest_metrics: Optional[dict]

@router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(user: dict = Depends(require_admin)):
    with get_conn() as conn:
        human = conn.execute("SELECT COUNT(*) as c FROM dataset_samples WHERE admin_label='HUMAN'").fetchone()["c"]
        ai = conn.execute("SELECT COUNT(*) as c FROM dataset_samples WHERE admin_label='AI'").fetchone()["c"]
        dur = conn.execute("SELECT COALESCE(SUM(duration_sec),0) as d FROM dataset_samples").fetchone()["d"]
        jobs = conn.execute("SELECT COUNT(*) as c FROM training_jobs").fetchone()["c"]
        deployed = conn.execute("SELECT version_id FROM model_versions WHERE deployed=1").fetchone()
        versions = conn.execute("SELECT COUNT(*) as c FROM model_versions").fetchone()["c"]
        latest_metrics_row = conn.execute("SELECT metrics_json FROM model_versions WHERE deployed=1").fetchone()
        latest_metrics = json.loads(latest_metrics_row["metrics_json"]) if latest_metrics_row else None
    return DashboardStats(
        dataset_human_count=human,
        dataset_ai_count=ai,
        dataset_total_duration_sec=dur,
        training_jobs_total=jobs,
        current_deployed_version=deployed["version_id"] if deployed else None,
        model_versions_total=versions,
        latest_metrics=latest_metrics,
    )
=======
from fastapi import APIRouter, Depends

from ..auth.admin_deps import require_admin

router = APIRouter()


@router.get('/_auth_test')
def auth_test(_user: dict = Depends(require_admin)):
    return {'ok': True}
>>>>>>> theirs
@router.get("/_auth_test")
def auth_test(_user: dict = Depends(require_admin)):
    return {"ok": True}