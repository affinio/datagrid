# Backend Template

Copy this into a new backend feature folder and replace the placeholders.

The sections below mark:

- required methods
- optional methods
- project-specific sections
- do-not-change sections

## `columns.py`

```py
from __future__ import annotations

from affino_grid_backend import GridColumnDefinition

# PROJECT-SPECIFIC: replace <FeatureName>, <ColumnRegistry>, and enum values.
<ColumnRegistry> = {
    "id": GridColumnDefinition(
        id="id",
        model_attr="id",
        readonly=True,
        sortable=True,
        filterable=True,
    ),
    "index": GridColumnDefinition(
        id="index",
        model_attr="row_index",
        readonly=True,
        sortable=True,
        filterable=True,
    ),
    # PROJECT-SPECIFIC: define editable and histogram-enabled columns here.
}
```

## `table.py`

```py
from __future__ import annotations

from affino_grid_backend import GridTableDefinition
from .columns import <ColumnRegistry>
from .models import <RowModel>

# REQUIRED: keep this definition stable.
<TableId>_TABLE = GridTableDefinition(
    table_id="<TableId>",
    model=<RowModel>,
    row_id_attr="id",
    workspace_id_attr="workspace_id",
    row_index_attr="row_index",
    updated_at_attr="updated_at",
    columns=<ColumnRegistry>,
    default_sort_column_id="index",
)
```

## `schemas.py`

```py
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# DO-NOT-CHANGE: field names should stay aligned with the protocol.


class <FeatureName>PullRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    range: dict[str, int]
    sort_model: list[dict[str, Any]] = Field(default_factory=list, alias="sortModel")
    filter_model: dict[str, Any] | None = Field(default=None, alias="filterModel")


class <FeatureName>Row(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    index: int
    title: str
    status: str
    category: str
    current_price: int | None = Field(alias="currentPrice")
    updated_at: datetime = Field(alias="updatedAt")


class <FeatureName>PullResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[<FeatureName>Row] = Field(default_factory=list)
    total: int
    revision: str | None = None
    dataset_version: int = Field(alias="datasetVersion")


class <FeatureName>MutationInvalidationCell(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    row_id: str = Field(alias="rowId")
    column_id: str = Field(alias="columnId")


class <FeatureName>MutationInvalidationRange(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    start_row: int = Field(alias="startRow")
    end_row: int = Field(alias="endRow")
    start_column: str | None = Field(default=None, alias="startColumn")
    end_column: str | None = Field(default=None, alias="endColumn")


class <FeatureName>MutationInvalidation(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    type: Literal["cell", "range", "row", "dataset"]
    cells: list[<FeatureName>MutationInvalidationCell] = Field(default_factory=list)
    rows: list[str] = Field(default_factory=list)
    range: <FeatureName>MutationInvalidationRange | None = None


class <FeatureName>MutationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    operation_id: str | None = Field(default=None, alias="operationId")
    revision: str
    dataset_version: int = Field(alias="datasetVersion")
    affected_rows: int = Field(alias="affectedRows")
    affected_cells: int = Field(alias="affectedCells")
    can_undo: bool = Field(alias="canUndo")
    can_redo: bool = Field(alias="canRedo")
    latest_undo_operation_id: str | None = Field(default=None, alias="latestUndoOperationId")
    latest_redo_operation_id: str | None = Field(default=None, alias="latestRedoOperationId")
    invalidation: <FeatureName>MutationInvalidation | None = None
```

## `repository.py`

```py
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from affino_grid_backend import GridInvalidationService, GridRevisionService
from .models import <RowModel>
from .projection import <FeatureName>ProjectionService
from .schemas import <FeatureName>PullRequest, <FeatureName>PullResponse, <FeatureName>Row
from .table import <TableId>_TABLE


class <FeatureName>Repository:
    def __init__(self, session: AsyncSession, workspace_id: str | None = None):
        self._session = session
        self._workspace_id = workspace_id
        self._projection = <FeatureName>ProjectionService(<TableId>_TABLE, workspace_id=workspace_id)
        self._revision = GridRevisionService(<TableId>_TABLE, workspace_id=workspace_id)
        self._edits = <FeatureName>EditService(<TableId>_TABLE.columns, self._revision, workspace_id=workspace_id)
        self._fill = <FeatureName>FillService(<TableId>_TABLE.columns, self._projection, self._revision, workspace_id=workspace_id)
        self._history = <FeatureName>HistoryService(<TableId>_TABLE.columns, self._revision, workspace_id=workspace_id)
        self._invalidation = GridInvalidationService()

    async def pull(self, request: <FeatureName>PullRequest) -> <FeatureName>PullResponse:
        # REQUIRED: translate filters, sort, and offset/limit to SQLAlchemy.
        conditions = self._projection.build_filter_conditions(request.filter_model)
        stmt = self._projection.build_row_query(conditions)
        stmt = stmt.order_by(*self._projection.build_order_by(request.sort_model))
        stmt = stmt.offset(request.range["startRow"]).limit(request.range["endRow"] - request.range["startRow"])

        rows = (await self._session.scalars(stmt)).all()
        total = await self._projection.count_rows(self._session, conditions)
        revision = await self._revision.get_revision(self._session)
        return <FeatureName>PullResponse(rows=[self._to_row(row) for row in rows], total=total, revision=revision)

    def _to_row(self, row: <RowModel>) -> <FeatureName>Row:
        return <FeatureName>Row(
            id=<TableId>_TABLE.row_id_value(row),
            index=<TableId>_TABLE.row_index_value(row),
            title=row.title,
            status=row.status,
            category=row.category,
            currentPrice=row.current_price,
            updatedAt=<TableId>_TABLE.updated_at_value(row),
        )
```

The repository should also expose stack history and change-feed methods:

- `undo_latest_operation`
- `redo_latest_operation`
- `history_status`
- `change_feed`

## `router.py`

```py
from __future__ import annotations

from fastapi import APIRouter, Depends, Header

from .repository import <FeatureName>Repository
from .schemas import <FeatureName>PullRequest, <FeatureName>PullResponse
from your_app.infrastructure.db import get_db

router = APIRouter(prefix="/<route_prefix>", tags=["<FeatureName>"])


def get_<feature_name>_repository(
    session = Depends(get_db),
    workspace_id: str | None = Header(default=None, alias="X-Workspace-Id"),
) -> <FeatureName>Repository:
    return <FeatureName>Repository(session, workspace_id=workspace_id)
```

Required route handlers:

- `GET /health`
- `POST /pull`
- `POST /histogram`
- `POST /edits`
- `POST /fill-boundary`
- `POST /fill/commit`
- `POST /history/undo`
- `POST /history/redo`
- `POST /history/status`
- `POST /operations/{operation_id}/undo`
- `POST /operations/{operation_id}/redo`
- `GET /changes?sinceVersion=...`

## `tests`

```py
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_<feature_name>_pull_scoped_to_workspace(client):
    response = await client.post(
        "/api/<route_prefix>/pull",
        json={"range": {"startRow": 0, "endRow": 20}},
        headers={"X-Workspace-Id": "workspace-a"},
    )
    assert response.status_code == 200
```

Recommended tests:

- pull respects workspace scope
- edit returns `row-not-found` for a row in another workspace
- histogram counts only scoped rows
- fill boundary stays scoped
- fill commit rejects cross-workspace ids
- stack undo/redo respects workspace scope
- history status respects workspace / user / session scope
- change feed returns the expected changes or dataset fallback

## Do-Not-Change Sections

- Keep `revision` semantics monotonic.
- Keep request and response field names aligned with the protocol.
- Keep the workspace header name stable until the host app binds it to auth.
- Keep unsupported server-side series fill rejected.
- Keep stack history as the normal undo/redo UX.
- Keep operation-id replay available only for diagnostics/manual replay.
