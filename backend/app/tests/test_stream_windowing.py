import asyncio
import threading

import pytest

from ..main import calls, policies
from ..websocket.handler import RAWNET2_WINDOW_SAMPLES, VoiceAnalysisManager, VoiceAnalysisSession


class _Adapter:
    def analyze(self, samples, sample_rate):
        raise AssertionError("inference should not run")

    def detect(self, samples, sample_rate):
        raise AssertionError("inference should not run")

    def verify(self, samples, sample_rate, identity_id):
        raise AssertionError("inference should not run")


def _manager(window_samples=RAWNET2_WINDOW_SAMPLES, stride_samples=16000):
    adapter = _Adapter()
    return VoiceAnalysisManager(adapter, adapter, adapter, window_samples, stride_samples)


@pytest.mark.asyncio
async def test_no_inference_before_complete_rawnet2_window():
    manager = _manager()
    session = VoiceAnalysisSession("short")
    manager._queue_latest_window(session, [0.1] * (RAWNET2_WINDOW_SAMPLES - 1))
    await asyncio.sleep(0)
    assert session.inference_task is None
    assert len(session.audio_buffer) == RAWNET2_WINDOW_SAMPLES - 1


@pytest.mark.asyncio
async def test_windows_are_exact_stride_based_and_buffer_is_bounded():
    manager = _manager(window_samples=8, stride_samples=3)
    session = VoiceAnalysisSession("window")
    blocker = asyncio.Event()

    async def wait_forever():
        await blocker.wait()

    session.inference_task = asyncio.create_task(wait_forever())
    manager._queue_latest_window(session, [0.0] * 8)
    assert session.pending_window == [0.0] * 8
    manager._queue_latest_window(session, [1.0] * 2)
    assert session.window_count == 1
    manager._queue_latest_window(session, [2.0] * 1)
    assert session.window_count == 2
    assert session.pending_window == [0.0] * 5 + [1.0] * 2 + [2.0]
    manager._queue_latest_window(session, [3.0] * 20)
    assert len(session.audio_buffer) == 8
    assert len(session.pending_window) == 8
    session.inference_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await session.inference_task


@pytest.mark.asyncio
async def test_busy_inference_coalesces_to_newest_window_without_overlap():
    manager = _manager(window_samples=8, stride_samples=2)
    session = VoiceAnalysisSession("coalesce")
    started = threading.Event()
    release = threading.Event()
    calls_seen = []
    active = 0
    max_active = 0

    def run_inference(session_id, identity_id, window):
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        calls_seen.append(window)
        started.set()
        release.wait(timeout=2)
        active -= 1
        raise RuntimeError("stop after recording")

    manager._run_inference = run_inference
    manager._queue_latest_window(session, [0.0] * 8)
    await asyncio.to_thread(started.wait, 1)
    manager._queue_latest_window(session, [1.0] * 2)
    manager._queue_latest_window(session, [2.0] * 2)
    manager._queue_latest_window(session, [3.0] * 2)
    release.set()
    await asyncio.wait_for(session.inference_task, timeout=2)
    assert max_active == 1
    assert calls_seen == [[0.0] * 8, [0.0] * 2 + [1.0] * 2 + [2.0] * 2 + [3.0] * 2]


@pytest.mark.asyncio
async def test_calls_and_policies_expose_active_configured_data():
    from ..main import manager

    session = VoiceAnalysisSession("active", "identity")
    session.risk_state = "SUSPICIOUS"
    session.history.append({"risk_state": "SUSPICIOUS", "fused_risk_score": 0.7})
    manager._sessions[session.session_id] = session
    try:
        active_calls = await calls()
        configured_policies = await policies()
    finally:
        manager._sessions.pop(session.session_id, None)
    assert active_calls[0]["session_id"] == "active"
    assert active_calls[0]["history"] == session.history
    assert configured_policies[0]["id"] == "pol_01"
    assert configured_policies[0]["enabled"] is True
