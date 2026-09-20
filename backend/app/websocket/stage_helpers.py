from typing import Optional

from .telemetry_instrumentation import StageTiming


def ensure_stage(timing: Optional[StageTiming], *, chunk_seq: int, t_capture_ms: float) -> StageTiming:
    if timing is not None:
        return timing
    return StageTiming(chunk_seq=chunk_seq, t_capture_ms=t_capture_ms, t_ws_send_ms=0.0, t_ws_recv_ms=0.0,
                        t_preprocess_start_ms=0.0, t_preprocess_end_ms=0.0, t_window_ready_ms=0.0,
                        t_queue_depth=0)
