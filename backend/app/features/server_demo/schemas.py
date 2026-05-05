from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


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
    edits: list[ServerDemoEditItem] = Field(default_factory=list)


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
    model_config = ConfigDict(extra="forbid")

    kind: Literal["range"]
    range: ServerDemoInvalidationRange
    reason: str


class ServerDemoCommitEditsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    committed: list[ServerDemoCommittedEdit] = Field(default_factory=list)
    committed_row_ids: list[str] = Field(default_factory=list, alias="committedRowIds")
    rejected: list[ServerDemoRejectedEdit] = Field(default_factory=list)
    revision: str
    invalidation: ServerDemoEditInvalidation | None = None
