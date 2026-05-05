from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.server_demo.columns import SERVER_DEMO_COLUMNS
from app.features.server_demo.edits import ServerDemoEditService
from app.features.server_demo.fill import ServerDemoFillService
from app.features.server_demo.history import ServerDemoHistoryService
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.projection import ServerDemoProjectionService
from app.features.server_demo.schemas import (
    ServerDemoCommitEditsRequest,
    ServerDemoCommitEditsResponse,
    ServerDemoFillBoundaryRequest,
    ServerDemoFillBoundaryResponse,
    ServerDemoFillCommitRequest,
    ServerDemoFillCommitResponse,
    ServerDemoEditInvalidation,
    ServerDemoInvalidationRange,
    ServerDemoHistogramResponse,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
    ServerDemoRow as ServerDemoRowSchema,
)


class ServerDemoRepository:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._projection = ServerDemoProjectionService(SERVER_DEMO_COLUMNS)
        self._edits = ServerDemoEditService(SERVER_DEMO_COLUMNS)
        self._fill = ServerDemoFillService(SERVER_DEMO_COLUMNS, self._projection)
        self._history = ServerDemoHistoryService(SERVER_DEMO_COLUMNS)

    async def health(self) -> None:
        await self._session.scalar(select(func.max(GridDemoRowModel.row_index)))

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse:
        conditions = self._projection.build_filter_conditions(request.filter_model)
        stmt = self._projection.build_row_query(conditions)
        stmt = stmt.order_by(*self._projection.build_order_by(request.sort_model))
        stmt = stmt.offset(request.range.start_row).limit(request.range.end_row - request.range.start_row)

        rows = (await self._session.scalars(stmt)).all()
        total = await self._projection.count_rows(self._session, conditions)
        revision = await self._revision_token()
        return ServerDemoPullResponse(
            rows=[self._to_row(row) for row in rows],
            total=total,
            revision=revision,
        )

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse:
        return await self._projection.histogram(self._session, column_id, filter_model)

    async def commit_edits(self, request: ServerDemoCommitEditsRequest) -> ServerDemoCommitEditsResponse:
        result = await self._edits.commit_edits(self._session, request)
        revision = await self._revision_token()
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=result.committed,
            committed_row_ids=result.committed_row_ids,
            rejected=result.rejected,
            revision=revision,
            invalidation=self._build_history_invalidation("edit", result.affected_indexes),
        )

    async def resolve_fill_boundary(self, request: ServerDemoFillBoundaryRequest) -> ServerDemoFillBoundaryResponse:
        return await self._fill.resolve_boundary(self._session, request)

    async def commit_fill(self, request: ServerDemoFillCommitRequest) -> ServerDemoFillCommitResponse:
        result = await self._fill.commit_fill(self._session, request)
        revision = await self._revision_token()
        return ServerDemoFillCommitResponse(
            operation_id=result.operation_id,
            affected_row_count=len(result.affected_row_ids),
            affected_cell_count=result.affected_cell_count,
            revision=revision,
            invalidation=self._build_fill_invalidation(result.affected_indexes),
            warnings=result.warnings,
        )

    async def undo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.undo_operation(self._session, operation_id)
        revision = await self._revision_token()
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=result.committed,
            committed_row_ids=result.committed_row_ids,
            rejected=result.rejected,
            revision=revision,
            invalidation=self._build_history_invalidation(result.operation_type, result.affected_indexes),
        )

    async def redo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.redo_operation(self._session, operation_id)
        revision = await self._revision_token()
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=result.committed,
            committed_row_ids=result.committed_row_ids,
            rejected=result.rejected,
            revision=revision,
            invalidation=self._build_history_invalidation(result.operation_type, result.affected_indexes),
        )

    def _operation_invalidation_reason(self, operation_type: str) -> str:
        if operation_type == "fill":
            return "server-demo-fill"
        return "server-demo-edits"

    async def _revision_token(self) -> str:
        stmt = select(func.max(GridDemoRowModel.updated_at)).select_from(GridDemoRowModel)
        revision = await self._session.scalar(stmt)
        if revision is None:
            return "empty"
        return revision.isoformat()

    def _build_history_invalidation(
        self,
        operation_type: str,
        affected_indexes: Sequence[int],
    ) -> ServerDemoEditInvalidation | None:
        if not affected_indexes:
            return None
        return ServerDemoEditInvalidation(
            kind="range",
            range=ServerDemoInvalidationRange(
                start=min(affected_indexes),
                end=max(affected_indexes),
            ),
            reason=self._operation_invalidation_reason(operation_type),
        )

    def _build_fill_invalidation(self, affected_indexes: Sequence[int]) -> ServerDemoEditInvalidation | None:
        return self._build_history_invalidation("fill", affected_indexes)

    def _to_row(self, row: GridDemoRowModel) -> ServerDemoRowSchema:
        return ServerDemoRowSchema(
            id=row.id,
            index=row.row_index,
            name=row.name,
            segment=row.segment,
            status=row.status,
            region=row.region,
            value=row.value,
            updated_at=row.updated_at,
        )
