from dataclasses import dataclass
import time
from typing import Optional


@dataclass
class StageTiming:
    chunk_seq: int
    t_capture_ms: float
    t_ws_send_ms: float
    t_ws_recv_ms: float
    t_preprocess_start_ms: float
    t_preprocess_end_ms: float
    t_window_ready_ms: float
    t_queue_depth: int
    t_inference_start_ms: Optional[float] = None
    t_inference_end_ms: Optional[float] = None
    t_event_emitted_ms: Optional[float] = None
    t_event_received_client_ms: Optional[float] = None


def now_ms() -> float:
    return time.time() * 1000
