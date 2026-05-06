from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class GridHistoryStatus:
    can_undo: bool
    can_redo: bool
    latest_undo_operation_id: str | None
    latest_redo_operation_id: str | None


@dataclass(frozen=True)
class GridCommittedCell:
    row_id: str
    column_id: str
    revision: str


@dataclass(frozen=True)
class GridRejectedCell:
    row_id: str
    column_id: str
    reason: str


@dataclass(frozen=True)
class PendingGridCellEvent:
    row: Any
    row_id: str
    column_id: str
    before_value: Any
    after_value: Any


@dataclass(frozen=True)
class GridMutationResult:
    operation_id: str | None
    committed: list[GridCommittedCell]
    committed_row_ids: list[str]
    rejected: list[GridRejectedCell]
    affected_indexes: list[int]
    revision: str
    rows: list[Any]
    history_status: GridHistoryStatus | None = None


@dataclass(frozen=True)
class GridFillMutationResult:
    operation_id: str | None
    affected_row_ids: list[str]
    affected_indexes: list[int]
    affected_cell_count: int
    warnings: list[str]
    revision: str
    rows: list[Any]
    history_status: GridHistoryStatus | None = None


@dataclass(frozen=True)
class GridHistoryApplyResult:
    operation_id: str
    operation_type: str
    committed: list[GridCommittedCell]
    committed_row_ids: list[str]
    rejected: list[GridRejectedCell]
    affected_indexes: list[int]
    revision: str
    rows: list[Any]
