import time
from typing import Optional, List
from .persistence import get_policies_from_db

DEFAULT_POLICIES = [
    {
        "id": "pol_01",
        "name": "Critical Threat Termination",
        "description": "Terminate session on CRITICAL risk state",
        "risk_threshold": "CRITICAL",
        "action": "TERMINATE_SESSION",
        "enabled": True,
    },
    {
        "id": "pol_02",
        "name": "High Risk Challenge",
        "description": "Require step-up verification on HIGH_RISK",
        "risk_threshold": "HIGH_RISK",
        "action": "REQUIRE_STEP_UP_VERIFICATION",
        "enabled": True,
    },
    {
        "id": "pol_03",
        "name": "Suspicious Route to Analyst",
        "description": "Route to SOC analyst on SUSPICIOUS",
        "risk_threshold": "SUSPICIOUS",
        "action": "ROUTE_TO_ANALYST",
        "enabled": True,
    },
]

RISK_SEVERITY_ORDER = ["TRUSTED", "MONITOR", "SUSPICIOUS", "HIGH_RISK", "CRITICAL", "UNVERIFIED", "INSUFFICIENT_EVIDENCE"]

def _load_policies() -> List[dict]:
    try:
        return get_policies_from_db()
    except Exception:
        # fallback to defaults if DB not ready
        return [
            {"id": "pol_01", "name": "Critical Threat Termination", "description": "Terminate session on CRITICAL risk state", "risk_threshold": "CRITICAL", "action": "TERMINATE_SESSION", "enabled": True},
            {"id": "pol_02", "name": "High Risk Challenge", "description": "Require step-up verification on HIGH_RISK", "risk_threshold": "HIGH_RISK", "action": "REQUIRE_STEP_UP_VERIFICATION", "enabled": True},
            {"id": "pol_03", "name": "Suspicious Route to Analyst", "description": "Route to SOC analyst on SUSPICIOUS", "risk_threshold": "SUSPICIOUS", "action": "ROUTE_TO_ANALYST", "enabled": True},
        ]

def evaluate_policies(
    risk_state: str,
    fused_risk_score: Optional[float],
    session_id: str,
) -> Optional[dict]:
    triggered = None
    highest_severity = -1
    
    for policy in _load_policies():
        if not policy.get("enabled", True):
            continue
        if risk_state == policy["risk_threshold"]:
            severity_idx = RISK_SEVERITY_ORDER.index(risk_state) if risk_state in RISK_SEVERITY_ORDER else -1
            if severity_idx > highest_severity:
                highest_severity = severity_idx
                triggered = {
                    "policy_id": policy["id"],
                    "policy_name": policy["name"],
                    "action": policy["action"],
                    "reason": f"Risk state '{risk_state}' triggered policy '{policy['name']}'",
                    "timestamp_ms": time.time() * 1000,
                    "session_id": session_id,
                    "severity": "critical" if risk_state == "CRITICAL" else "high" if risk_state == "HIGH_RISK" else "medium",
                }
    
    return triggered

def get_recommended_action(risk_state: str, policy_trigger: Optional[dict]) -> Optional[dict]:
    if risk_state in ("INSUFFICIENT_EVIDENCE", "UNVERIFIED"):
        return {
            "type": "MONITOR",
            "title": "Awaiting ML Inference",
            "description": "Audio stream active. Neural speaker and synthetic speech models not yet connected.",
            "requires_intervention": False,
        }
    
    if policy_trigger:
        action = policy_trigger["action"]
        if action == "TERMINATE_SESSION":
            return {
                "type": "TERMINATE_CALL",
                "title": "Terminate Session Immediately",
                "description": f"CRITICAL threat detected. Policy: {policy_trigger['policy_name']}",
                "requires_intervention": True,
            }
        elif action == "REQUIRE_STEP_UP_VERIFICATION":
            return {
                "type": "VERIFY_CALLER",
                "title": "Require Out-of-Band Identity Verification",
                "description": f"High risk detected. Policy: {policy_trigger['policy_name']}",
                "requires_intervention": True,
            }
        elif action == "ROUTE_TO_ANALYST":
            return {
                "type": "ESCALATE_ANALYST",
                "title": "Route to SOC Analyst",
                "description": f"Suspicious activity detected. Policy: {policy_trigger['policy_name']}",
                "requires_intervention": True,
            }
    
    if risk_state in ("TRUSTED", "MONITOR"):
        return {
            "type": "MONITOR",
            "title": "Continuous Monitoring Active",
            "description": "Voice characteristics within nominal security parameters.",
            "requires_intervention": False,
        }
    
    return None