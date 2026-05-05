from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class GridInvalidationReasonMap:
    edit: str = "server-demo-edits"
    fill: str = "server-demo-fill"


@dataclass(frozen=True)
class GridRangeInvalidation:
    kind: Literal["range"]
    range_start: int
    range_end: int
    reason: str


@dataclass(frozen=True)
class GridRowsInvalidation:
    kind: Literal["rows"]
    row_ids: list[str]
    reason: str


GridInvalidation = GridRangeInvalidation | GridRowsInvalidation


class GridInvalidationService:
    def __init__(self, reason_map: GridInvalidationReasonMap):
        self._reason_map = reason_map

    def build_range_invalidation(self, operation_type: str, affected_indexes: Sequence[int]) -> GridRangeInvalidation | None:
        if not affected_indexes:
            return None
        reason = self._reason_for_operation(operation_type)
        return GridRangeInvalidation(
            kind="range",
            range_start=min(affected_indexes),
            range_end=max(affected_indexes),
            reason=reason,
        )

    def build_rows_invalidation(self, operation_type: str, row_ids: Sequence[str]) -> GridRowsInvalidation | None:
        normalized_row_ids = [row_id.strip() for row_id in row_ids if row_id and row_id.strip()]
        if not normalized_row_ids:
            return None
        reason = self._reason_for_operation(operation_type)
        return GridRowsInvalidation(
            kind="rows",
            row_ids=list(dict.fromkeys(normalized_row_ids)),
            reason=reason,
        )

    def _reason_for_operation(self, operation_type: str) -> str:
        return self._reason_map.fill if operation_type == "fill" else self._reason_map.edit
