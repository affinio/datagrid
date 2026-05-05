from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class GridInvalidationReasonMap:
    edit: str = "server-demo-edits"
    fill: str = "server-demo-fill"


@dataclass(frozen=True)
class GridRangeInvalidation:
    kind: str
    range_start: int
    range_end: int
    reason: str


class GridInvalidationService:
    def __init__(self, reason_map: GridInvalidationReasonMap):
        self._reason_map = reason_map

    def build_range_invalidation(self, operation_type: str, affected_indexes: Sequence[int]) -> GridRangeInvalidation | None:
        if not affected_indexes:
            return None
        reason = self._reason_map.fill if operation_type == "fill" else self._reason_map.edit
        return GridRangeInvalidation(
            kind="range",
            range_start=min(affected_indexes),
            range_end=max(affected_indexes),
            reason=reason,
        )
