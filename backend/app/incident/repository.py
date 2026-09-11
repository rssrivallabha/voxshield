import sqlite3
import time
import uuid
from typing import Optional, List, Dict, Any
from ..db import get_conn

class IncidentRepository:
    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    def _conn_ctx(self):
        if self._conn:
            return self._conn
        return get_conn()

    def create(self, session_id: str, policy: Dict[str, Any], risk_state: str, risk_score: Optional[float], evidence: List[Dict]) -> Dict[str, Any]:
        incident_id = f"inc_{uuid.uuid4().hex[:12]}"
        now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        import json
        evidence_json = json.dumps(evidence)
        with self._conn_ctx() as conn:
            # deduplication: check existing open/ack incident for same session+policy
            existing = conn.execute(
                "SELECT id, status FROM incidents WHERE session_id=? AND policy_id=? AND status IN ('OPEN','ACKNOWLEDGED')",
                (session_id, policy["policy_id"])
            ).fetchone()
            if existing:
                # update updated_at and return existing
                conn.execute(
                    "UPDATE incidents SET updated_at=?, risk_state=?, risk_score=?, evidence_json=? WHERE id=?",
                    (now, risk_state, risk_score, evidence_json, existing["id"])
                )
                conn.commit()
                return self.get(existing["id"])
            try:
                conn.execute(
                    """INSERT INTO incidents (id, session_id, policy_id, policy_name, severity, risk_state, risk_score, action, reason, status, created_at, updated_at, evidence_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (incident_id, session_id, policy["policy_id"], policy["policy_name"],
                     policy["severity"], risk_state, risk_score, policy["action"], policy["reason"],
                     "OPEN", now, now, evidence_json)
                )
                conn.commit()
            except sqlite3.IntegrityError:
                # race condition: another request inserted the same active incident
                conn.rollback()
                existing = conn.execute(
                    "SELECT id FROM incidents WHERE session_id=? AND policy_id=? AND status IN ('OPEN','ACKNOWLEDGED')",
                    (session_id, policy["policy_id"])
                ).fetchone()
                if existing:
                    conn.execute(
                        "UPDATE incidents SET updated_at=?, risk_state=?, risk_score=?, evidence_json=? WHERE id=?",
                        (now, risk_state, risk_score, evidence_json, existing["id"])
                    )
                    conn.commit()
                    return self.get(existing["id"])
                raise
        return self.get(incident_id)

    def get(self, incident_id: str) -> Optional[Dict[str, Any]]:
        with self._conn_ctx() as conn:
            row = conn.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
            if not row:
                return None
            return dict(row)

    def list(self, session_id: Optional[str] = None, status: Optional[str] = None, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        query = "SELECT * FROM incidents WHERE 1=1"
        params = []
        if session_id:
            query += " AND session_id=?"
            params.append(session_id)
        if status:
            query += " AND status=?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        with self._conn_ctx() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def update_status(self, incident_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        allowed = {"OPEN", "ACKNOWLEDGED", "RESOLVED"}
        if new_status not in allowed:
            raise ValueError(f"Invalid status {new_status}")
        now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        with self._conn_ctx() as conn:
            cur = conn.execute("SELECT status FROM incidents WHERE id=?", (incident_id,))
            row = cur.fetchone()
            if not row:
                return None
            # validate transition
            current = row["status"]
            valid = {
                "OPEN": {"ACKNOWLEDGED", "RESOLVED"},
                "ACKNOWLEDGED": {"RESOLVED"},
                "RESOLVED": set()
            }
            if new_status not in valid.get(current, set()):
                raise ValueError(f"Invalid transition from {current} to {new_status}")
            conn.execute(
                "UPDATE incidents SET status=?, updated_at=? WHERE id=?",
                (new_status, now, incident_id)
            )
            conn.commit()
        return self.get(incident_id)