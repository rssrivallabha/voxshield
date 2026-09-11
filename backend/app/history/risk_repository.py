import sqlite3
import time
import uuid
from typing import Optional, List, Dict
from ..db import get_conn

class RiskHistoryRepository:
    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    def _conn_ctx(self):
        if self._conn:
            return self._conn
        return get_conn()

    def add(self, session_id: str, risk_state: str, fused_risk_score: Optional[float], evidence: List[dict], policy: Optional[dict]):
        rid = f"rh_{uuid.uuid4().hex[:12]}"
        now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        import json
        with self._conn_ctx() as conn:
            conn.execute(
                """INSERT INTO risk_history (id, session_id, timestamp, risk_state, fused_risk_score, evidence_json, policy_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (rid, session_id, now, risk_state, fused_risk_score,
                 json.dumps(evidence) if evidence else None,
                 json.dumps(policy) if policy else None)
            )
            conn.commit()

    def get_for_session(self, session_id: str, limit: int = 200, offset: int = 0) -> List[Dict]:
        with self._conn_ctx() as conn:
            rows = conn.execute(
                "SELECT * FROM risk_history WHERE session_id=? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (session_id, limit, offset)
            ).fetchall()
            return [dict(r) for r in rows]