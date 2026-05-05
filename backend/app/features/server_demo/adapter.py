from __future__ import annotations

from typing import Any, Protocol

from app.grid.contracts import GridDataAdapter
from app.features.server_demo.schemas import (
    ServerDemoCommitEditsRequest,
    ServerDemoCommitEditsResponse,
    ServerDemoFillBoundaryRequest,
    ServerDemoFillBoundaryResponse,
    ServerDemoFillCommitRequest,
    ServerDemoFillCommitResponse,
    ServerDemoHistogramResponse,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
)


class ServerGridDataAdapter(GridDataAdapter, Protocol):
    async def health(self) -> None: ...

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse: ...

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse: ...

    async def commit_edits(self, request: ServerDemoCommitEditsRequest) -> ServerDemoCommitEditsResponse: ...

    async def resolve_fill_boundary(self, request: ServerDemoFillBoundaryRequest) -> ServerDemoFillBoundaryResponse: ...

    async def commit_fill(self, request: ServerDemoFillCommitRequest) -> ServerDemoFillCommitResponse: ...

    async def undo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse: ...

    async def redo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse: ...
