from ..policy.engine import evaluate_policies, get_recommended_action

def test_critical_triggers_terminate():
    trigger = evaluate_policies("CRITICAL", 95.0, "sess_01")
    assert trigger is not None
    assert trigger["action"] == "TERMINATE_SESSION"

def test_high_risk_triggers_verification():
    trigger = evaluate_policies("HIGH_RISK", 70.0, "sess_01")
    assert trigger is not None
    assert trigger["action"] == "REQUIRE_STEP_UP_VERIFICATION"

def test_trusted_no_policy():
    trigger = evaluate_policies("TRUSTED", 5.0, "sess_01")
    assert trigger is None

def test_insufficient_evidence_recommended_action():
    action = get_recommended_action("INSUFFICIENT_EVIDENCE", None)
    assert action is not None
    assert action["type"] == "MONITOR"
    assert action["requires_intervention"] is False

def test_critical_recommended_action():
    action = get_recommended_action("CRITICAL", {"action": "TERMINATE_SESSION", "policy_name": "Critical"})
    assert action is not None
    assert action["type"] == "TERMINATE_CALL"
    assert action["requires_intervention"] is True