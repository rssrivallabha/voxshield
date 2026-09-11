import json
import os
import sys
import sqlite3
import torch
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import patch
import app.db as db_module

# Create an in-memory SQLite database for testing
_test_conn = None

def _get_test_conn():
    global _test_conn
    if _test_conn is None:
        _test_conn = sqlite3.connect(":memory:", check_same_thread=False)
        _test_conn.row_factory = sqlite3.Row
        # Create all required tables
        _create_test_schema(_test_conn)
    return _test_conn

def _create_test_schema(conn):
    """Create all required tables for testing."""
    conn.executescript("""
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT
    );

    CREATE TABLE IF NOT EXISTS dataset_samples (
        sample_id TEXT PRIMARY KEY,
        original_filename TEXT NOT NULL,
        generated_reference_name TEXT NOT NULL,
        custom_display_name TEXT,
        admin_label TEXT NOT NULL CHECK(admin_label IN ('HUMAN','AI')),
        model_prediction TEXT CHECK(model_prediction IN ('HUMAN','AI')),
        model_version_used_for_inference TEXT,
        raw_synthetic_probability REAL,
        uploader_id TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        duration_sec REAL NOT NULL,
        sample_rate INTEGER NOT NULL,
        channels INTEGER NOT NULL,
        preprocessing_status TEXT NOT NULL DEFAULT 'PENDING',
        dataset_version INTEGER NOT NULL DEFAULT 1,
        included_in_training INTEGER NOT NULL DEFAULT 0,
        production_identity_id TEXT,
        stored_path TEXT NOT NULL,
        speaker_id TEXT,
        FOREIGN KEY(uploader_id) REFERENCES users(id),
        FOREIGN KEY(production_identity_id) REFERENCES production_identities(identity_id)
    );

    CREATE TABLE IF NOT EXISTS production_identities (
        identity_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        enrollment_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_jobs (
        job_id TEXT PRIMARY KEY,
        dataset_version INTEGER NOT NULL,
        parent_model_version TEXT,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        started_at TEXT,
        completed_at TEXT,
        config_json TEXT,
        metrics_json TEXT,
        artifact_path TEXT,
        created_by TEXT NOT NULL,
        validation_method TEXT,
        FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS model_versions (
        version_id TEXT PRIMARY KEY,
        parent_version_id TEXT,
        training_job_id TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        approval_state TEXT NOT NULL DEFAULT 'PENDING',
        deployed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        approved_at TEXT,
        deployed_at TEXT,
        FOREIGN KEY(training_job_id) REFERENCES training_jobs(job_id),
        FOREIGN KEY(parent_version_id) REFERENCES model_versions(version_id)
    );

    CREATE TABLE IF NOT EXISTS naming_counters (
        namespace TEXT PRIMARY KEY,
        next_number INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        policy_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        risk_state TEXT NOT NULL,
        risk_score REAL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        evidence_json TEXT,
        FOREIGN KEY(session_id) REFERENCES dataset_samples(sample_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_active ON incidents(session_id, policy_id) WHERE status IN ('OPEN','ACKNOWLEDGED');

    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS risk_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        risk_state TEXT NOT NULL,
        fused_risk_score REAL,
        evidence_json TEXT,
        policy_json TEXT
    );

    CREATE TABLE IF NOT EXISTS inference_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        raw_synthetic_probability REAL,
        ai_detection_score REAL,
        model_version TEXT,
        speaker_verification_json TEXT,
        metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        risk_threshold TEXT NOT NULL,
        action TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

_test_conn = None

class _NoCloseConnection:
    """Wrapper that prevents the connection from being closed by context managers."""
    def __init__(self, conn):
        self._conn = conn
    
    def __getattr__(self, name):
        return getattr(self._conn, name)
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        # Don't actually close the connection
        pass
    
    def close(self):
        # Override close to do nothing
        pass

_test_conn = None

def _get_test_conn():
    global _test_conn
    if _test_conn is None:
        # Use shared in-memory database so all connections see the same data
        raw_conn = sqlite3.connect("file::memory:?cache=shared", uri=True, check_same_thread=False)
        raw_conn.row_factory = sqlite3.Row
        _create_test_schema(raw_conn)
        _test_conn = _NoCloseConnection(raw_conn)
    return _test_conn

def _close_test_conn():
    global _test_conn
    if _test_conn is not None:
        _test_conn._conn.close()
        _test_conn = None

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Use in-memory database for tests
    db_module.DB_PATH = ":memory:"
    # Initialize schema in the in-memory database
    conn = _get_test_conn()
    # Monkey-patch get_conn to use our test connection
    import app.db as db_module_local
    import app.training.trainer as trainer_module
    original_get_conn = db_module_local.get_conn
    original_trainer_get_conn = trainer_module.get_conn
    db_module_local.get_conn = _get_test_conn
    trainer_module.get_conn = _get_test_conn
    yield
    # Restore original get_conn
    db_module_local.get_conn = original_get_conn
    trainer_module.get_conn = original_trainer_get_conn
    _close_test_conn()
def _insert_sample(conn, label, speaker_id=None):
    import uuid, time
    sample_id = f"smp_{uuid.uuid4().hex[:12]}"
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    # Ensure uploader user exists
    conn.execute(
        """INSERT OR IGNORE INTO users (id, email, name, role, department) VALUES (?,?,?,?,?)""",
        ("usr_adm_01", "admin@voxshield.sec", "Chief Security Officer", "admin", "Executive Security")
    )
    conn.execute(
        """INSERT INTO dataset_samples
        (sample_id, original_filename, generated_reference_name, admin_label,
         model_prediction, model_version_used_for_inference, raw_synthetic_probability,
         uploader_id, uploaded_at, duration_sec, sample_rate, channels,
         preprocessing_status, dataset_version, stored_path, speaker_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sample_id, f"{label}.wav", f"{label} VOICE 1", label,
         label, "rawnet2-baseline", 0.5 if label=="HUMAN" else 0.9,
         "usr_adm_01", now, 1.0, 16000, 1, "COMPLETED", 1,
         f"/tmp/{sample_id}.wav", speaker_id)
    )
    conn.commit()
    return sample_id


def test_speaker_separated_split():
    # Import here after monkey-patch
    from app.db import get_conn
    from app.training.trainer import train_job
    import app.training.trainer as trainer_module
    from unittest.mock import patch
    from app.inference.rawnet2.model import RawNet2Model
    
    with get_conn() as conn:
        # insert samples with speaker ids (need at least 10 samples)
        for i in range(5):
            _insert_sample(conn, "HUMAN", "spk1")
            _insert_sample(conn, "HUMAN", "spk1")
        for i in range(5):
            _insert_sample(conn, "AI", "spk2")
            _insert_sample(conn, "AI", "spk3")
        # create training job
        job_id = "trn_test_01"
        config = {"seed": 42, "epochs": 1, "batch_size": 2, "lr": 1e-4, "weight_decay": 1e-5, "dataset_version": 1}
        conn.execute(
            """INSERT INTO training_jobs (job_id, dataset_version, config_json, created_by) VALUES (?,?,?,?)""",
            (job_id, 1, json.dumps(config), "usr_adm_01")
        )
        conn.commit()

    # Mock _load_audio to return dummy tensors and mock model forward to avoid shape issues
    with patch.object(trainer_module, '_load_audio', return_value=torch.zeros(64000)):
        with patch.object(RawNet2Model, 'forward', return_value={"logits": torch.zeros(2, 2, requires_grad=True)}):
            # run training job (will run speaker-aware split)
            train_job(job_id)
    
    with get_conn() as conn:
        row = conn.execute("SELECT validation_method FROM training_jobs WHERE job_id=?", (job_id,)).fetchone()
        assert row["validation_method"] == "speaker_separated"
        # ensure model version created
        mv = conn.execute("SELECT * FROM model_versions WHERE training_job_id=?", (job_id,)).fetchone()
        assert mv is not None

def test_random_split_when_missing_speaker():
    # Import here after monkey-patch
    from app.db import get_conn
    from app.training.trainer import train_job
    import app.training.trainer as trainer_module
    from app.inference.rawnet2.model import RawNet2Model
    from unittest.mock import patch
    
    with get_conn() as conn:
        # insert samples without speaker ids (need at least 10)
        for i in range(5):
            _insert_sample(conn, "HUMAN", None)
            _insert_sample(conn, "AI", None)
        job_id = "trn_test_02"
        config = {"seed": 42, "epochs": 1, "batch_size": 2, "lr": 1e-4, "weight_decay": 1e-5, "dataset_version": 1}
        conn.execute(
            """INSERT INTO training_jobs (job_id, dataset_version, config_json, created_by) VALUES (?,?,?,?)""",
            (job_id, 1, json.dumps(config), "usr_adm_01")
        )
        conn.commit()

    # Mock _load_audio to return dummy tensors and model forward to avoid shape issues
    with patch.object(trainer_module, '_load_audio', return_value=torch.zeros(64000)):
        with patch.object(RawNet2Model, 'forward', return_value={"logits": torch.zeros(2, 2, requires_grad=True)}):
            train_job(job_id)
    
    with get_conn() as conn:
        row = conn.execute("SELECT validation_method FROM training_jobs WHERE job_id=?", (job_id,)).fetchone()
        assert row["validation_method"] == "random"