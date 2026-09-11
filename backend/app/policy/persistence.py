import sqlite3
from typing import List, Dict, Optional
from ..db import get_conn

def get_policies_from_db() -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM policies ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]

def update_policy_in_db(policy_id: str, updates: Dict) -> Optional[Dict]:
    allowed_fields = {"name", "description", "risk_threshold", "action", "enabled"}
    sets = []
    params = []
    for k, v in updates.items():
        if k in allowed_fields:
            sets.append(f"{k}=?")
            params.append(v)
    if not sets:
        return None
    import time
    sets.append("updated_at=?")
    params.append(time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()))
    params.append(policy_id)
    with get_conn() as conn:
        cur = conn.execute(f"UPDATE policies SET {', '.join(sets)} WHERE id=?", params)
        conn.commit()
        if cur.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM policies WHERE id=?", (policy_id,)).fetchone()
        return dict(row) if row else None