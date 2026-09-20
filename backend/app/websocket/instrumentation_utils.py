import time
from typing import Optional


def coalesce_queue_depth_limit(queue_limit: int, queued: int) -> int:
    if queue_limit <= 0:
        return queued
    return min(queued, queue_limit)


def now_ms() -> float:
    return time.time() * 1000
