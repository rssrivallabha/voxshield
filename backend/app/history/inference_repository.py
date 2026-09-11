import sqlite3
import time
import uuid
from typing import Optional, List, Dict
from ..db import get_conn

class InferenceHistoryRepository:
    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    def _conn_ctx(self):
        if self._conn:
            return self._conn
        return get_conn()

    def add(self, session_id: str, raw_prob: float, model_version: str, speaker_verification: Optional[dict], metadata: Optional[dict]):
        iid = f"inf_{uuid.uuid4().hex[:12]}"
        now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        ai_score = raw_prob * 100.0
        import json
        with self._conn_ctx() as conn:
            conn.execute(
                """INSERT INTO inference_history (id, session_id, timestamp, raw_synthetic_probability, ai_detection_score, model_version, speaker_verification_json, metadata_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (iid, session_id, now, raw_prob, ai_score, model_version,
                 json.dumps(speaker_verification) if speaker_verification else None,
                 json.dumps(metadata) if metadata else None)
            )
            conn.commit()

    def get_for_session(self, session_id: str, limit: int = 200, offset: int = 0) -> List[Dict]:
        with self._conn_ctx() as conn:
            rows = conn.execute(
                "SELECT * FROM inference_history WHERE session_id=? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (session_id, limit, offset)
            ).fetchall()
            return [dict(r) for r in rows]