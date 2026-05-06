from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.features.server_demo.history import (
    DEFAULT_SERVER_DEMO_SESSION_ID,
)


def _normalize_scope_value(value: str | None) -> str | None:
    normalized = value.strip() if value else ""
    return normalized or None


def _default_scope_value(value: str | None, default: str) -> str:
    return _normalize_scope_value(value) or default


class ServerDemoHealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str


class ServerDemoSortModelItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    col_id: str | None = Field(default=None, alias="colId")
    key: str | None = None
    sort: str | None = None
    direction: str | None = None

    def resolved_column_id(self) -> str | None:
        return self.col_id or self.key

    def resolved_direction(self) -> str | None:
        return self.sort or self.direction


class ServerDemoPullRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_row: int = Field(ge=0, alias="startRow")
    end_row: int = Field(ge=0, alias="endRow")

    def model_post_init(self, __context: Any) -> None:
        if self.end_row < self.start_row:
            raise ValueError("endRow must be greater than or equal to startRow")


class ServerDemoPullRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    range: ServerDemoPullRange
    sort_model: list[ServerDemoSortModelItem] = Field(default_factory=list, alias="sortModel")
    filter_model: dict[str, Any] | None = Field(default=None, alias="filterModel")


class ServerDemoRow(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    index: int
    name: str
    segment: str
    status: str
    region: str
    value: int | None
    updated_at: datetime = Field(alias="updatedAt")


class ServerDemoPullResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[ServerDemoRow] = Field(default_factory=list)
    total: int
    revision: str | None = None


class ServerDemoHistogramRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    column_id: str = Field(alias="columnId")
    filter_model: dict[str, Any] | None = Field(default=None, alias="filterModel")


class ServerDemoHistogramEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: Any
    count: int = Field(ge=0)


class ServerDemoHistogramResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    column_id: str = Field(alias="columnId")
    entries: list[ServerDemoHistogramEntry] = Field(default_factory=list)


class ServerDemoFillProjectionSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    sort_model: list[ServerDemoSortModelItem] = Field(default_factory=list, alias="sortModel")
    filter_model: dict[str, Any] | None = Field(default=None, alias="filterModel")
    group_by: dict[str, Any] | None = Field(default=None, alias="groupBy")
    group_expansion: dict[str, Any] | None = Field(default=None, alias="groupExpansion")
    tree_data: Any | None = Field(default=None, alias="treeData")
    pivot: dict[str, Any] | None = Field(default=None, alias="pivot")
    pagination: dict[str, Any] | None = Field(default=None, alias="pagination")


class ServerDemoFillRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_row: int = Field(ge=0, alias="startRow")
    end_row: int = Field(ge=0, alias="endRow")
    start_column: int = Field(ge=0, alias="startColumn")
    end_column: int = Field(ge=0, alias="endColumn")

    def model_post_init(self, __context: Any) -> None:
        if self.end_row < self.start_row:
            raise ValueError("endRow must be greater than or equal to startRow")
        if self.end_column < self.start_column:
            raise ValueError("endColumn must be greater than or equal to startColumn")


class ServerDemoFillBoundaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    direction: Literal["up", "down", "left", "right"]
    base_range: ServerDemoFillRange = Field(alias="baseRange")
    fill_columns: list[str] = Field(default_factory=list, alias="fillColumns")
    reference_columns: list[str] = Field(default_factory=list, alias="referenceColumns")
    projection: ServerDemoFillProjectionSnapshot
    start_row_index: int = Field(ge=0, alias="startRowIndex")
    start_column_index: int = Field(ge=0, alias="startColumnIndex")
    limit: int | None = Field(default=None, ge=0)


class ServerDemoFillBoundaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    end_row_index: int | None = Field(default=None, alias="endRowIndex")
    end_row_id: str | None = Field(default=None, alias="endRowId")
    boundary_kind: Literal["data-end", "gap", "cache-boundary", "projection-end", "unresolved"] = Field(
        alias="boundaryKind"
    )
    scanned_row_count: int = Field(ge=0, alias="scannedRowCount")
    truncated: bool
    revision: str | None = None
    projection_hash: str | None = Field(default=None, alias="projectionHash")
    boundary_token: str | None = Field(default=None, alias="boundaryToken")


class ServerDemoFillCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    workspace_id: str | None = Field(default=None, alias="workspaceId")
    table_id: str | None = Field(default=None, alias="tableId")
    user_id: str | None = Field(default=None, alias="userId")
    session_id: str | None = Field(default=None, alias="sessionId")
    revision: str | int | None = None
    base_revision: str | None = Field(default=None, alias="baseRevision")
    projection_hash: str | None = Field(default=None, alias="projectionHash")
    boundary_token: str | None = Field(default=None, alias="boundaryToken")
    source_range: ServerDemoFillRange = Field(alias="sourceRange")
    target_range: ServerDemoFillRange = Field(alias="targetRange")
    source_row_ids: list[str] = Field(default_factory=list, alias="sourceRowIds")
    target_row_ids: list[str] = Field(default_factory=list, alias="targetRowIds")
    fill_columns: list[str] = Field(default_factory=list, alias="fillColumns")
    reference_columns: list[str] = Field(default_factory=list, alias="referenceColumns")
    mode: Literal["copy", "series"]
    projection: ServerDemoFillProjectionSnapshot
    metadata: dict[str, Any] | None = None

    @model_validator(mode="after")
    def normalize_scope(self) -> "ServerDemoFillCommitRequest":
        self.workspace_id = _normalize_scope_value(self.workspace_id)
        self.table_id = _default_scope_value(self.table_id, "server_demo")
        self.user_id = _normalize_scope_value(self.user_id)
        self.session_id = _normalize_scope_value(self.session_id) or DEFAULT_SERVER_DEMO_SESSION_ID
        return self


class ServerDemoFillCommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    affected_row_count: int = Field(ge=0, alias="affectedRowCount")
    affected_cell_count: int = Field(ge=0, alias="affectedCellCount")
    affected_rows: int = Field(ge=0, alias="affectedRows")
    affected_cells: int = Field(ge=0, alias="affectedCells")
    revision: str
    can_undo: bool = Field(alias="canUndo")
    can_redo: bool = Field(alias="canRedo")
    latest_undo_operation_id: str | None = Field(default=None, alias="latestUndoOperationId")
    latest_redo_operation_id: str | None = Field(default=None, alias="latestRedoOperationId")
    invalidation: ServerDemoEditInvalidation | None = None
    warnings: list[str] = Field(default_factory=list)


class ServerDemoEditItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    row_id: str = Field(alias="rowId", min_length=1)
    column_id: str = Field(alias="columnId", min_length=1)
    value: Any
    previous_value: Any | None = Field(default=None, alias="previousValue")
    revision: str | None = None


class ServerDemoCommitEditsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    workspace_id: str | None = Field(default=None, alias="workspaceId")
    table_id: str | None = Field(default=None, alias="tableId")
    user_id: str | None = Field(default=None, alias="userId")
    session_id: str | None = Field(default=None, alias="sessionId")
    base_revision: str | None = Field(default=None, alias="baseRevision")
    edits: list[ServerDemoEditItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def normalize_scope(self) -> "ServerDemoCommitEditsRequest":
        self.workspace_id = _normalize_scope_value(self.workspace_id)
        self.table_id = _default_scope_value(self.table_id, "server_demo")
        self.user_id = _normalize_scope_value(self.user_id)
        self.session_id = _normalize_scope_value(self.session_id) or DEFAULT_SERVER_DEMO_SESSION_ID
        return self


class ServerDemoCommittedEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    row_id: str = Field(alias="rowId")
    column_id: str = Field(alias="columnId")
    revision: str


class ServerDemoRejectedEdit(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    row_id: str = Field(alias="rowId")
    column_id: str = Field(alias="columnId")
    reason: str


class ServerDemoInvalidationRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: int = Field(ge=0)
    end: int = Field(ge=0)


class ServerDemoEditInvalidation(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["range", "rows"]
    range: ServerDemoInvalidationRange | None = None
    row_ids: list[str] = Field(default_factory=list, alias="rowIds")
    reason: str


class ServerDemoCommitEditsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    committed: list[ServerDemoCommittedEdit] = Field(default_factory=list)
    committed_row_ids: list[str] = Field(default_factory=list, alias="committedRowIds")
    rejected: list[ServerDemoRejectedEdit] = Field(default_factory=list)
    affected_rows: int = Field(ge=0, alias="affectedRows")
    affected_cells: int = Field(ge=0, alias="affectedCells")
    revision: str
    can_undo: bool = Field(alias="canUndo")
    can_redo: bool = Field(alias="canRedo")
    latest_undo_operation_id: str | None = Field(default=None, alias="latestUndoOperationId")
    latest_redo_operation_id: str | None = Field(default=None, alias="latestRedoOperationId")
    invalidation: ServerDemoEditInvalidation | None = None


class ServerDemoHistoryStackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    workspace_id: str | None = Field(default=None, alias="workspaceId")
    table_id: str | None = Field(default=None, alias="tableId")
    user_id: str | None = Field(default=None, alias="userId")
    session_id: str | None = Field(default=None, alias="sessionId")

    @model_validator(mode="after")
    def require_user_or_session(self) -> "ServerDemoHistoryStackRequest":
        self.workspace_id = _normalize_scope_value(self.workspace_id)
        self.table_id = _default_scope_value(self.table_id, "server_demo")
        self.user_id = _normalize_scope_value(self.user_id)
        self.session_id = _normalize_scope_value(self.session_id) or DEFAULT_SERVER_DEMO_SESSION_ID
        return self


class ServerDemoHistoryStackResponse(ServerDemoCommitEditsResponse):
    action: Literal["undo", "redo"]


class ServerDemoHistoryStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    workspace_id: str | None = Field(default=None, alias="workspaceId")
    table_id: str | None = Field(default=None, alias="tableId")
    user_id: str | None = Field(default=None, alias="userId")
    session_id: str | None = Field(default=None, alias="sessionId")

    @model_validator(mode="after")
    def require_user_or_session(self) -> "ServerDemoHistoryStatusRequest":
        self.workspace_id = _normalize_scope_value(self.workspace_id)
        self.table_id = _default_scope_value(self.table_id, "server_demo")
        self.user_id = _normalize_scope_value(self.user_id)
        self.session_id = _normalize_scope_value(self.session_id) or DEFAULT_SERVER_DEMO_SESSION_ID
        return self


class ServerDemoHistoryStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    workspace_id: str | None = None
    table_id: str
    user_id: str | None = None
    session_id: str | None = None
    can_undo: bool = Field(alias="canUndo")
    can_redo: bool = Field(alias="canRedo")
    latest_undo_operation_id: str | None = Field(default=None, alias="latestUndoOperationId")
    latest_redo_operation_id: str | None = Field(default=None, alias="latestRedoOperationId")
