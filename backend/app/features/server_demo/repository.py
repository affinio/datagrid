from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.server_demo.adapter import ServerGridDataAdapter
from app.features.server_demo.edits import ServerDemoEditService
from app.features.server_demo.fill import ServerDemoFillService
from app.features.server_demo.history import ServerDemoHistoryService
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.projection import ServerDemoProjectionService
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.features.server_demo.workspace import workspace_scope_condition
from app.features.server_demo.schemas import (
    ServerDemoCommitEditsRequest,
    ServerDemoCommitEditsResponse,
    ServerDemoCommittedEdit,
    ServerDemoFillBoundaryRequest,
    ServerDemoFillBoundaryResponse,
    ServerDemoFillCommitRequest,
    ServerDemoFillCommitResponse,
    ServerDemoHistogramResponse,
    ServerDemoEditInvalidation,
    ServerDemoInvalidationRange,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
    ServerDemoRejectedEdit,
    ServerDemoRow as ServerDemoRowSchema,
)
from app.api.errors import ApiException
from app.grid.consistency import build_boundary_token, canonical_projection_hash
from app.grid.mutations import GridCommittedCell, GridRejectedCell
from app.grid.revision import GridRevisionService
from app.grid.invalidation import GridInvalidationReasonMap, GridInvalidationService

logger = logging.getLogger(__name__)


class ServerDemoRepository(ServerGridDataAdapter):
    def __init__(self, session: AsyncSession, workspace_id: str | None = None):
        self._session = session
        self._workspace_id = workspace_id
        self._projection = ServerDemoProjectionService(SERVER_DEMO_TABLE, workspace_id=workspace_id)
        self._revision = GridRevisionService(SERVER_DEMO_TABLE, workspace_id=workspace_id)
        self._edits = ServerDemoEditService(SERVER_DEMO_TABLE.columns, self._revision, workspace_id=workspace_id)
        self._fill = ServerDemoFillService(
            SERVER_DEMO_TABLE.columns,
            self._projection,
            self._revision,
            workspace_id=workspace_id,
        )
        self._history = ServerDemoHistoryService(
            SERVER_DEMO_TABLE.columns,
            self._revision,
            workspace_id=workspace_id,
        )
        self._invalidation = GridInvalidationService(GridInvalidationReasonMap())

    async def health(self) -> None:
        stmt = select(func.max(getattr(SERVER_DEMO_TABLE.model, SERVER_DEMO_TABLE.row_index_attr)))
        scope_condition = workspace_scope_condition(SERVER_DEMO_TABLE, self._workspace_id)
        if scope_condition is not None:
            stmt = stmt.where(scope_condition)
        await self._session.scalar(stmt)

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse:
        conditions = self._projection.build_filter_conditions(request.filter_model)
        stmt = self._projection.build_row_query(conditions)
        stmt = stmt.order_by(*self._projection.build_order_by(request.sort_model))
        stmt = stmt.offset(request.range.start_row).limit(request.range.end_row - request.range.start_row)

        rows = (await self._session.scalars(stmt)).all()
        total = await self._projection.count_rows(self._session, conditions)
        revision = await self._revision.get_revision(self._session)
        return ServerDemoPullResponse(
            rows=[self._to_row(row) for row in rows],
            total=total,
            revision=revision,
        )

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse:
        return await self._projection.histogram(self._session, column_id, filter_model)

    async def commit_edits(self, request: ServerDemoCommitEditsRequest) -> ServerDemoCommitEditsResponse:
        current_revision = await self._read_current_revision_for_logging()
        self._log_revision_mismatch(
            operation_kind="edit",
            requested_base_revision=request.base_revision,
            current_revision=current_revision,
        )
        result = await self._edits.commit_edits(self._session, request)
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=[self._to_committed_edit(item) for item in result.committed],
            committed_row_ids=result.committed_row_ids,
            rejected=[self._to_rejected_edit(item) for item in result.rejected],
            revision=result.revision,
            invalidation=self._to_invalidation(self._invalidation.build_range_invalidation("edit", result.affected_indexes)),
        )

    async def resolve_fill_boundary(self, request: ServerDemoFillBoundaryRequest) -> ServerDemoFillBoundaryResponse:
        boundary = await self._fill.resolve_boundary(self._session, request)
        revision = await self._revision.get_revision(self._session)
        projection_hash = canonical_projection_hash(request.projection)
        boundary_payload = boundary.model_dump(exclude={"revision", "projection_hash", "boundary_token"})
        boundary_token = self._build_boundary_token(
            revision=revision,
            projection_hash=projection_hash,
            start_row_index=request.start_row_index,
            end_row_index=boundary_payload["end_row_index"],
            end_row_id=boundary_payload["end_row_id"],
        )
        return ServerDemoFillBoundaryResponse(**boundary_payload, revision=revision, projection_hash=projection_hash, boundary_token=boundary_token)

    async def commit_fill(self, request: ServerDemoFillCommitRequest) -> ServerDemoFillCommitResponse:
        current_revision = await self._read_current_revision_for_logging()
        projection_hash = canonical_projection_hash(request.projection)
        self._raise_fill_consistency_error(
            request=request,
            current_revision=current_revision,
            projection_hash=projection_hash,
        )
        result = await self._fill.commit_fill(self._session, request)
        return ServerDemoFillCommitResponse(
            operation_id=result.operation_id,
            affected_row_count=len(result.affected_row_ids),
            affected_cell_count=result.affected_cell_count,
            revision=result.revision,
            invalidation=self._to_invalidation(self._invalidation.build_range_invalidation("fill", result.affected_indexes)),
            warnings=result.warnings,
        )

    async def undo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.undo_operation(self._session, operation_id)
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=[self._to_committed_edit(item) for item in result.committed],
            committed_row_ids=result.committed_row_ids,
            rejected=[self._to_rejected_edit(item) for item in result.rejected],
            revision=result.revision,
            invalidation=self._to_invalidation(
                self._invalidation.build_range_invalidation(result.operation_type, result.affected_indexes)
            ),
        )

    async def redo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.redo_operation(self._session, operation_id)
        return ServerDemoCommitEditsResponse(
            operation_id=result.operation_id,
            committed=[self._to_committed_edit(item) for item in result.committed],
            committed_row_ids=result.committed_row_ids,
            rejected=[self._to_rejected_edit(item) for item in result.rejected],
            revision=result.revision,
            invalidation=self._to_invalidation(
                self._invalidation.build_range_invalidation(result.operation_type, result.affected_indexes)
            ),
        )

    def _to_row(self, row: GridDemoRowModel) -> ServerDemoRowSchema:
        return ServerDemoRowSchema(
            id=SERVER_DEMO_TABLE.row_id_value(row),
            index=SERVER_DEMO_TABLE.row_index_value(row),
            name=row.name,
            segment=row.segment,
            status=row.status,
            region=row.region,
            value=row.value,
            updated_at=SERVER_DEMO_TABLE.updated_at_value(row),
        )

    def _to_committed_edit(self, item: GridCommittedCell) -> ServerDemoCommittedEdit:
        return ServerDemoCommittedEdit(row_id=item.row_id, column_id=item.column_id, revision=item.revision)

    def _to_rejected_edit(self, item: GridRejectedCell) -> ServerDemoRejectedEdit:
        return ServerDemoRejectedEdit(row_id=item.row_id, column_id=item.column_id, reason=item.reason)

    def _to_invalidation(
        self,
        invalidation: object | None,
    ) -> ServerDemoEditInvalidation | None:
        if invalidation is None:
            return None
        return self._map_invalidation(invalidation)

    def _map_invalidation(self, invalidation: object) -> ServerDemoEditInvalidation:
        from app.grid.invalidation import GridRangeInvalidation

        assert isinstance(invalidation, GridRangeInvalidation)
        return ServerDemoEditInvalidation(
            kind=invalidation.kind,
            range=ServerDemoInvalidationRange(start=invalidation.range_start, end=invalidation.range_end),
            reason=invalidation.reason,
        )

    async def _read_current_revision_for_logging(self) -> str:
        revision = await self._revision.get_revision(self._session)
        if self._session.in_transaction():
            await self._session.rollback()
        return revision

    def _log_revision_mismatch(
        self,
        *,
        operation_kind: str,
        requested_base_revision: str | None,
        current_revision: str,
    ) -> None:
        if requested_base_revision is None or requested_base_revision == current_revision:
            return
        logger.warning(
            "server-demo %s commit baseRevision mismatch: requested=%s current=%s",
            operation_kind,
            requested_base_revision,
            current_revision,
        )

    def _raise_fill_consistency_error(
        self,
        *,
        request: ServerDemoFillCommitRequest,
        current_revision: str,
        projection_hash: str,
    ) -> None:

        if request.base_revision is not None and request.base_revision != current_revision:
            raise ApiException(
                status_code=409,
                code="stale-revision",
                message="Fill commit revision is stale",
            )

        if request.projection_hash is not None and request.projection_hash != projection_hash:
            raise ApiException(
                status_code=409,
                code="projection-mismatch",
                message="Fill commit projection does not match boundary projection",
            )

        if request.boundary_token is not None:
            expected_boundary_token = self._build_boundary_token(
                revision=current_revision,
                projection_hash=projection_hash,
                start_row_index=request.source_range.start_row,
                end_row_index=request.target_range.end_row,
                end_row_id=request.target_row_ids[-1] if request.target_row_ids else None,
            )
            if request.boundary_token != expected_boundary_token:
                raise ApiException(
                    status_code=409,
                    code="boundary-mismatch",
                    message="Fill commit boundary token is invalid",
                )

    def _build_boundary_token(
        self,
        *,
        revision: str,
        projection_hash: str,
        start_row_index: int,
        end_row_index: int | None,
        end_row_id: str | None,
    ) -> str:
        return build_boundary_token(
            {
                "revision": revision,
                "projectionHash": projection_hash,
                "startRowIndex": start_row_index,
                "endRowIndex": end_row_index,
                "endRowId": end_row_id,
            }
        )
