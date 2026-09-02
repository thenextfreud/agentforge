"""Per-token sliding-window rate limiter.

Tracks request timestamps per token subject and rejects requests that
exceed the configured rate. Uses an in-memory dictionary; for multi-
process deployments swap in Redis.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class RateLimiter:
    """Sliding-window rate limiter keyed by token subject."""

    max_per_minute: int = 60
    _buckets: dict[str, deque[float]] = field(default_factory=dict)

    def _prune(self, key: str, now: float) -> deque[float]:
        bucket = self._buckets.setdefault(key, deque())
        window = 60.0
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        return bucket

    def check(self, key: str) -> tuple[bool, int]:
        """Return ``(allowed, remaining)`` for the given key."""
        now = time.time()
        bucket = self._prune(key, now)
        if len(bucket) >= self.max_per_minute:
            return False, 0
        bucket.append(now)
        return True, self.max_per_minute - len(bucket)

    def reset(self, key: str | None = None) -> None:
        if key is None:
            self._buckets.clear()
        else:
            self._buckets.pop(key, None)
