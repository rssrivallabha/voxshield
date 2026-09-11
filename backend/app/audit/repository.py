import sqlite3
import time
import uuid
from typing import Optional, List, Dict, Any
from ..db import get_conn

class AuditRepository:
    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self._conn = conn

    def _conn_ctx(self):
        if self._conn:
            return self._conn
        return get_conn()

    def log(self, actor_id: str, action: str, resource_type: str, resource_id: Optional[str], metadata: Optional[Dict] = None):
        audit_id = f"aud_{uuid.uuid4().hex[:12]}"
        now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        import json
        meta_json = json.dumps(metadata) if metadata else None
        with self._conn_ctx() as conn:
            conn.execute(
                """INSERT INTO audit_logs (id, timestamp, actor_id, action, resource_type, resource_id, metadata_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (audit_id, now, actor_id, action, resource_type, resource_id, meta_json)
            )
            conn.commit()

    def list(self, actor_id: Optional[str] = None, resource_type: Optional[str] = None, limit: int = 100, offset: int = 0) -> List[Dict]:
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params = []
        if actor_id:
            query += " AND actor_id=?"
            params.append(actor_id)
        if resource_type:
            query += " AND resource_type=?"
            params.append(resource_type)
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        with self._conn_ctx() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]