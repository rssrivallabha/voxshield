import sqlite3
import os
from contextlib import contextmanager
from typing import Generator

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "voxshield.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

SCHEMA = """
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
"""

def init_db():
    with _connect() as conn:
        conn.executescript(SCHEMA)
        # ensure naming counters exist
        for ns in ("AI_VOICE", "HUMAN_VOICE"):
            conn.execute(
                "INSERT OR IGNORE INTO naming_counters (namespace, next_number) VALUES (?, 1)",
                (ns,),
            )
        # ensure default policies exist
        cur = conn.execute("SELECT COUNT(*) as c FROM policies")
        if cur.fetchone()["c"] == 0:
            import time, json
            from .policy.engine import DEFAULT_POLICIES
            now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            for p in DEFAULT_POLICIES:
                conn.execute(
                    """INSERT INTO policies (id, name, description, risk_threshold, action, enabled, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (p["id"], p["name"], p["description"], p["risk_threshold"], p["action"], 1, now, now)
                )
        conn.commit()

@contextmanager
def _connect() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def get_conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)