"""Pydantic DTOs for the reusable DataGrid backend companion layer."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ViewportRange(BaseModel):
    """Inclusive row viewport bounds."""

    model_config = ConfigDict(extra="forbid")

    start: int = Field(ge=0)
    end: int = Field(ge=0)

    def model_post_init(self, __context: Any) -> None:
        if self.end < self.start:
            raise ValueError("viewport range end must be greater than or equal to start")


class SortDescriptor(BaseModel):
    """Sort instruction for a single column."""

    model_config = ConfigDict(extra="forbid")

    key: str
    direction: str = Field(pattern="^(asc|desc)$")


class DataGridRowEntry(BaseModel):
    """Row payload returned from a backend pull."""

    model_config = ConfigDict(extra="allow")

    index: int = Field(ge=0)
    rowId: str
    row: dict[str, Any]
    kind: str | None = None
    groupMeta: dict[str, Any] | None = None
    state: dict[str, Any] | None = None


class DataGridPullRowsRequest(BaseModel):
    """Request envelope for viewport row pulls."""

    model_config = ConfigDict(extra="forbid")

    range: ViewportRange
    priority: str
    reason: str
    sortModel: list[SortDescriptor] = Field(default_factory=list)
    filterModel: dict[str, Any] | None = None
    groupBy: dict[str, Any] | None = None
    groupExpansion: dict[str, Any] | None = None
    treeData: dict[str, Any] | None = None
    pivot: dict[str, Any] | None = None
    pagination: dict[str, Any] | None = None


class DataGridPullRowsResponse(BaseModel):
    """Response envelope for viewport row pulls."""

    model_config = ConfigDict(extra="forbid")

    rows: list[DataGridRowEntry] = Field(default_factory=list)
    total: int | None = None
    pivotColumns: list[dict[str, Any]] | None = None
    cursor: str | None = None
    revision: str | int | None = None


class DataGridColumnHistogramEntry(BaseModel):
    """Single histogram bucket returned by the backend."""

    model_config = ConfigDict(extra="forbid")

    token: str
    value: Any
    text: str
    count: int = Field(ge=0)


class DataGridColumnHistogramRequest(BaseModel):
    """Histogram request for a single frontend column key."""

    model_config = ConfigDict(extra="forbid")

    columnId: str
    options: dict[str, Any]
    sortModel: list[SortDescriptor] = Field(default_factory=list)
    filterModel: dict[str, Any] | None = None
    groupBy: dict[str, Any] | None = None
    groupExpansion: dict[str, Any] | None = None
    treeData: dict[str, Any] | None = None
    pivot: dict[str, Any] | None = None
    pagination: dict[str, Any] | None = None


class DataGridCommitEdit(BaseModel):
    """Single cell edit payload."""

    model_config = ConfigDict(extra="forbid")

    rowId: str
    data: dict[str, Any]


class DataGridCommitEditsRequest(BaseModel):
    """Batch edit request."""

    model_config = ConfigDict(extra="forbid")

    edits: list[DataGridCommitEdit] = Field(default_factory=list)
    revision: str | int | None = None


class DataGridCommitResult(BaseModel):
    """Status for one row affected by a write."""

    model_config = ConfigDict(extra="forbid")

    rowId: str
    revision: str | int | None = None
    reason: str | None = None


class DataGridCommitEditsResponse(BaseModel):
    """Batch edit response."""

    model_config = ConfigDict(extra="forbid")

    committed: list[DataGridCommitResult] = Field(default_factory=list)
    rejected: list[DataGridCommitResult] = Field(default_factory=list)
    revision: str | int | None = None
    invalidation: dict[str, Any] | None = None


class DataGridInvalidation(BaseModel):
    """Cache invalidation payload."""

    model_config = ConfigDict(extra="forbid")

    kind: str
    reason: str | None = None
    range: ViewportRange | None = None


class DataGridFillOperationRequest(BaseModel):
    """Fill operation request envelope."""

    model_config = ConfigDict(extra="forbid")

    operationId: str | None = None
    revision: str | int | None = None
    projection: dict[str, Any]
    sourceRange: ViewportRange
    targetRange: ViewportRange
    fillColumns: list[str] = Field(default_factory=list)
    referenceColumns: list[str] = Field(default_factory=list)
    mode: str
    sourceRowIds: list[str] | None = None
    targetRowIds: list[str] | None = None
    metadata: dict[str, Any] | None = None


class DataGridFillOperationResponse(BaseModel):
    """Fill operation write response."""

    model_config = ConfigDict(extra="forbid")

    operationId: str
    revision: str | int | None = None
    affectedRowCount: int = Field(ge=0)
    affectedCellCount: int | None = None
    invalidation: DataGridInvalidation | None = None
    undoToken: str | None = None
    redoToken: str | None = None
    warnings: list[str] = Field(default_factory=list)


class DataGridUndoFillOperationRequest(BaseModel):
    """Undo fill request envelope."""

    model_config = ConfigDict(extra="forbid")

    operationId: str
    revision: str | int | None = None
    projection: dict[str, Any] | None = None


class DataGridUndoFillOperationResponse(BaseModel):
    """Undo fill response."""

    model_config = ConfigDict(extra="forbid")

    operationId: str
    revision: str | int | None = None
    invalidation: DataGridInvalidation | None = None
    warnings: list[str] = Field(default_factory=list)

