from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as core_config
from app.features.server_demo.adapter import ServerGridDataAdapter
from app.features.server_demo.edits import ServerDemoEditService
from app.features.server_demo.fill import ServerDemoFillService
from app.features.server_demo.history import ServerDemoHistoryService
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.models import ServerDemoChangeEvent, ServerDemoOperation
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
    ServerDemoHistoryStackRequest,
    ServerDemoHistoryStackResponse,
    ServerDemoHistoryStatusRequest,
    ServerDemoHistoryStatusResponse,
    ServerDemoHistogramResponse,
    ServerDemoChangeFeedChange,
    ServerDemoChangeFeedResponse,
    ServerDemoMutationCellInvalidation,
    ServerDemoMutationInvalidation,
    ServerDemoMutationRangeInvalidation,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
    ServerDemoRejectedEdit,
    ServerDemoRow as ServerDemoRowSchema,
)
from app.api.errors import ApiException
from affino_grid_backend.core.consistency import build_boundary_token, canonical_projection_hash
from affino_grid_backend.core.mutations import GridCommittedCell, GridHistoryStatus, GridRejectedCell
from affino_grid_backend.core.revision import GridRevisionService
from app.infrastructure.db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class ServerDemoRepository(ServerGridDataAdapter):
    def __init__(self, session: AsyncSession, workspace_id: str | None = None):
        self._session = session
        self._workspace_id = workspace_id
        settings = core_config.get_settings()
        self._projection = ServerDemoProjectionService(
            SERVER_DEMO_TABLE,
            workspace_id=workspace_id,
            max_histogram_buckets=settings.grid_max_histogram_buckets,
            max_histogram_source_rows=settings.grid_max_histogram_source_rows,
        )
        self._revision = GridRevisionService(SERVER_DEMO_TABLE, workspace_id=workspace_id)
        self._history = ServerDemoHistoryService(
            SERVER_DEMO_TABLE.columns,
            self._revision,
            workspace_id=workspace_id,
        )
        self._edits = ServerDemoEditService(
            SERVER_DEMO_TABLE.columns,
            self._revision,
            workspace_id=workspace_id,
            history_service=self._history,
            max_batch_edits=settings.grid_max_batch_edits,
        )
        self._fill = ServerDemoFillService(
            SERVER_DEMO_TABLE.columns,
            self._projection,
            self._revision,
            workspace_id=workspace_id,
            history_service=self._history,
            max_fill_target_rows=settings.grid_max_fill_target_rows,
            max_boundary_scan_limit=settings.grid_max_boundary_scan_limit,
            max_fill_source_rows=settings.grid_max_fill_source_rows,
            max_fill_columns=settings.grid_max_fill_columns,
            max_fill_cells=settings.grid_max_fill_cells,
        )
    async def health(self) -> None:
        stmt = select(func.max(getattr(SERVER_DEMO_TABLE.model, SERVER_DEMO_TABLE.row_index_attr)))
        scope_condition = workspace_scope_condition(SERVER_DEMO_TABLE, self._workspace_id)
        if scope_condition is not None:
            stmt = stmt.where(scope_condition)
        await self._session.scalar(stmt)

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse:
        settings = core_config.get_settings()
        requested_rows = request.range.end_row - request.range.start_row
        if requested_rows > settings.grid_max_pull_rows:
            raise ApiException(
                status_code=400,
                code="pull-range-too-large",
                message="Requested range exceeds maximum allowed size",
            )

        conditions = self._projection.build_filter_conditions(request.filter_model)
        total = await self._count_rows_with_policy(conditions, settings.grid_max_filter_count_rows)
        stmt = self._projection.build_row_query(conditions)
        stmt = stmt.order_by(*self._projection.build_order_by(request.sort_model))
        stmt = stmt.offset(request.range.start_row).limit(request.range.end_row - request.range.start_row)

        rows = (await self._session.scalars(stmt)).all()
        revision = await self._revision.get_revision(self._session)
        return ServerDemoPullResponse(
            rows=[self._to_row(row) for row in rows],
            total=total,
            revision=revision,
            dataset_version=self._dataset_version(revision),
        )

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse:
        return await self._projection.histogram(self._session, column_id, filter_model)

    async def commit_edits(self, request: ServerDemoCommitEditsRequest) -> ServerDemoCommitEditsResponse:
        current_revision = await self._read_current_revision_for_logging()
        if request.base_revision is not None and request.base_revision != current_revision:
            raise ApiException(
                status_code=409,
                code="stale-revision",
                message="Edit commit revision is stale",
            )
        self._log_revision_mismatch(
            operation_kind="edit",
            requested_base_revision=request.base_revision,
            current_revision=current_revision,
        )
        result = await self._edits.commit_edits(self._session, request)
        response_payload = {
            "operation_id": result.operation_id,
            "committed": [self._to_committed_edit(item) for item in result.committed],
            "committed_row_ids": result.committed_row_ids,
            "rejected": [self._to_rejected_edit(item) for item in result.rejected],
            "revision": result.revision,
            "dataset_version": self._dataset_version(result.revision),
            "affected_rows": len(result.committed_row_ids),
            "affected_cells": len(result.committed),
            "invalidation": self._build_invalidation(
                operation_type="edit",
                affected_indexes=result.affected_indexes,
                committed=result.committed,
            ),
        }
        response_payload.update(self._history_response_fields(result.history_status))
        return ServerDemoCommitEditsResponse(**response_payload)

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
        response_payload = {
            "operation_id": result.operation_id,
            "affected_row_count": len(result.affected_row_ids),
            "affected_cell_count": result.affected_cell_count,
            "revision": result.revision,
            "dataset_version": self._dataset_version(result.revision),
            "affected_rows": len(result.affected_row_ids),
            "affected_cells": result.affected_cell_count,
            "invalidation": self._build_invalidation(
                operation_type="fill",
                affected_indexes=result.affected_indexes,
                committed=[],
                fill_columns=request.fill_columns,
            ),
            "warnings": result.warnings,
        }
        response_payload.update(self._history_response_fields(result.history_status))
        return ServerDemoFillCommitResponse(**response_payload)

    async def _count_rows_with_policy(self, conditions: list[Any], max_rows: int | None) -> int:
        total = await self._projection.count_rows(self._session, conditions)
        if max_rows is not None and total > max_rows:
            raise ApiException(
                status_code=400,
                code="filter-count-too-large",
                message="Filtered row count exceeds maximum allowed size",
            )
        return total

    async def undo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.undo_operation(self._session, operation_id)
        history_status = await self._history.get_status(
            self._session,
            workspace_id=self._workspace_id,
        )
        response_payload = {
            "operation_id": result.operation_id,
            "committed": [self._to_committed_edit(item) for item in result.committed],
            "committed_row_ids": result.committed_row_ids,
            "rejected": [self._to_rejected_edit(item) for item in result.rejected],
            "revision": result.revision,
            "dataset_version": self._dataset_version(result.revision),
            "affected_rows": len(result.committed_row_ids),
            "affected_cells": len(result.committed),
            "invalidation": self._build_invalidation(
                operation_type=result.operation_type,
                affected_indexes=result.affected_indexes,
                committed=result.committed,
            ),
        }
        response_payload.update(self._history_response_fields(
            GridHistoryStatus(
                can_undo=history_status.can_undo,
                can_redo=history_status.can_redo,
                latest_undo_operation_id=history_status.latest_undo_operation_id,
                latest_redo_operation_id=history_status.latest_redo_operation_id,
            )
        ))
        await self._record_change_event(
            revision=result.revision,
            invalidation=response_payload["invalidation"],
            operation_id=result.operation_id,
            user_id=operation.user_id if (operation := await self._load_operation(operation_id)) is not None else None,
            session_id=operation.session_id if operation is not None else None,
        )
        return ServerDemoCommitEditsResponse(**response_payload)

    async def redo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        result = await self._history.redo_operation(self._session, operation_id)
        history_status = await self._history.get_status(
            self._session,
            workspace_id=self._workspace_id,
        )
        response_payload = {
            "operation_id": result.operation_id,
            "committed": [self._to_committed_edit(item) for item in result.committed],
            "committed_row_ids": result.committed_row_ids,
            "rejected": [self._to_rejected_edit(item) for item in result.rejected],
            "revision": result.revision,
            "dataset_version": self._dataset_version(result.revision),
            "affected_rows": len(result.committed_row_ids),
            "affected_cells": len(result.committed),
            "invalidation": self._build_invalidation(
                operation_type=result.operation_type,
                affected_indexes=result.affected_indexes,
                committed=result.committed,
            ),
        }
        response_payload.update(self._history_response_fields(
            GridHistoryStatus(
                can_undo=history_status.can_undo,
                can_redo=history_status.can_redo,
                latest_undo_operation_id=history_status.latest_undo_operation_id,
                latest_redo_operation_id=history_status.latest_redo_operation_id,
            )
        ))
        operation = await self._load_operation(operation_id)
        await self._record_change_event(
            revision=result.revision,
            invalidation=response_payload["invalidation"],
            operation_id=result.operation_id,
            user_id=operation.user_id if operation is not None else None,
            session_id=operation.session_id if operation is not None else None,
        )
        return ServerDemoCommitEditsResponse(**response_payload)

    async def undo_latest_operation(self, request: ServerDemoHistoryStackRequest) -> ServerDemoHistoryStackResponse:
        self._require_supported_history_table(request.table_id)
        result = await self._history.undo_latest_operation(
            self._session,
            table_id=request.table_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        return await self._to_history_stack_response(result, request, action="undo")

    async def redo_latest_operation(self, request: ServerDemoHistoryStackRequest) -> ServerDemoHistoryStackResponse:
        self._require_supported_history_table(request.table_id)
        result = await self._history.redo_latest_operation(
            self._session,
            table_id=request.table_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        return await self._to_history_stack_response(result, request, action="redo")

    async def _to_history_stack_response(
        self,
        result: Any,
        request: ServerDemoHistoryStackRequest,
        *,
        action: str,
    ) -> ServerDemoHistoryStackResponse:
        status = await self._history.get_status(
            self._session,
            table_id=request.table_id,
            workspace_id=request.workspace_id or self._workspace_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        response_payload = {
            "operation_id": result.operation_id,
            "action": action,
            "affected_rows": len(result.committed_row_ids),
            "affected_cells": len(result.committed),
            "committed": [self._to_committed_edit(item) for item in result.committed],
            "committed_row_ids": result.committed_row_ids,
            "rejected": [self._to_rejected_edit(item) for item in result.rejected],
            "revision": result.revision,
            "dataset_version": self._dataset_version(result.revision),
            "invalidation": self._build_invalidation(
                operation_type=result.operation_type,
                affected_indexes=result.affected_indexes,
                committed=result.committed,
            ),
        }
        response_payload.update(
            self._history_response_fields(
                GridHistoryStatus(
                    can_undo=status.can_undo,
                    can_redo=status.can_redo,
                    latest_undo_operation_id=status.latest_undo_operation_id,
                    latest_redo_operation_id=status.latest_redo_operation_id,
                )
            )
        )
        await self._record_change_event(
            revision=result.revision,
            invalidation=response_payload["invalidation"],
            operation_id=result.operation_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        return ServerDemoHistoryStackResponse(**response_payload)

    async def change_feed(self, since_version: int) -> ServerDemoChangeFeedResponse:
        settings = core_config.get_settings()
        current_revision = await self._read_current_revision_for_logging()
        current_version = self._dataset_version(current_revision)

        if since_version > current_version:
            raise ApiException(
                status_code=400,
                code="invalid-since-version",
                message="sinceVersion cannot be greater than the current dataset version",
            )

        if since_version == current_version:
            return ServerDemoChangeFeedResponse(dataset_version=current_version, changes=[])

        gap = current_version - since_version
        if gap > settings.grid_max_change_feed_gap:
            return ServerDemoChangeFeedResponse(
                dataset_version=current_version,
                changes=[self._dataset_change_feed_change()],
            )

        stmt = (
            select(ServerDemoChangeEvent)
            .where(
                ServerDemoChangeEvent.table_id == SERVER_DEMO_TABLE.table_id,
                ServerDemoChangeEvent.workspace_id == self._workspace_id,
                ServerDemoChangeEvent.revision > since_version,
                ServerDemoChangeEvent.revision <= current_version,
            )
            .order_by(ServerDemoChangeEvent.revision.asc(), ServerDemoChangeEvent.id.asc())
        )
        events = (await self._session.scalars(stmt)).all()
        if len(events) != gap:
            return ServerDemoChangeFeedResponse(
                dataset_version=current_version,
                changes=[self._dataset_change_feed_change()],
            )

        return ServerDemoChangeFeedResponse(
            dataset_version=current_version,
            changes=[self._to_change_feed_change(event) for event in events],
        )

    async def history_status(self, request: ServerDemoHistoryStatusRequest) -> ServerDemoHistoryStatusResponse:
        self._require_supported_history_table(request.table_id)
        status = await self._history.get_status(
            self._session,
            table_id=request.table_id,
            workspace_id=request.workspace_id or self._workspace_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        revision = await self._read_history_dataset_version(request)
        return ServerDemoHistoryStatusResponse(
            workspace_id=request.workspace_id or self._workspace_id,
            table_id=request.table_id,
            user_id=request.user_id,
            session_id=request.session_id,
            can_undo=status.can_undo,
            can_redo=status.can_redo,
            latest_undo_operation_id=status.latest_undo_operation_id,
            latest_redo_operation_id=status.latest_redo_operation_id,
            dataset_version=self._dataset_version(revision),
        )

    async def _load_operation(self, operation_id: str) -> ServerDemoOperation | None:
        stmt = select(ServerDemoOperation).where(
            ServerDemoOperation.operation_id == operation_id,
            ServerDemoOperation.table_id == SERVER_DEMO_TABLE.table_id,
            ServerDemoOperation.workspace_id == self._workspace_id,
        )
        return await self._session.scalar(stmt)

    async def _record_change_event(
        self,
        *,
        revision: str | None,
        invalidation: ServerDemoMutationInvalidation | None,
        operation_id: str | None,
        user_id: str | None,
        session_id: str | None,
    ) -> None:
        if revision is None:
            return
        revision_value = self._dataset_version(revision)
        if revision_value <= 0:
            return

        invalidation_payload = (
            invalidation.model_dump(mode="json", by_alias=True) if invalidation is not None else self._dataset_invalidation().model_dump(mode="json", by_alias=True)
        )
        self._session.add(
            ServerDemoChangeEvent(
                revision=revision_value,
                workspace_id=self._workspace_id,
                table_id=SERVER_DEMO_TABLE.table_id,
                operation_id=operation_id,
                user_id=user_id,
                session_id=session_id,
                change_type=str(invalidation_payload.get("type", "dataset")),
                invalidation=invalidation_payload,
                created_at=self._timestamp_for_change_event(),
            )
        )
        await self._session.commit()

    def _to_change_feed_change(self, event: ServerDemoChangeEvent) -> ServerDemoChangeFeedChange:
        invalidation = ServerDemoMutationInvalidation.model_validate(event.invalidation)
        return ServerDemoChangeFeedChange(
            type=invalidation.type,
            invalidation=invalidation,
            operation_id=event.operation_id,
            user_id=event.user_id,
            session_id=event.session_id,
        )

    def _dataset_change_feed_change(self) -> ServerDemoChangeFeedChange:
        invalidation = self._dataset_invalidation()
        return ServerDemoChangeFeedChange(
            type=invalidation.type,
            invalidation=invalidation,
            operation_id=None,
            user_id=None,
            session_id=None,
        )

    @staticmethod
    def _timestamp_for_change_event():
        from datetime import datetime, timezone

        return datetime.now(timezone.utc)

    async def _read_history_dataset_version(self, request: ServerDemoHistoryStatusRequest) -> int:
        candidate_workspace_ids: list[str | None] = []
        if self._workspace_id not in candidate_workspace_ids:
            candidate_workspace_ids.append(self._workspace_id)
        if request.workspace_id is not None and request.workspace_id not in candidate_workspace_ids:
            candidate_workspace_ids.append(request.workspace_id)
        if None not in candidate_workspace_ids:
            candidate_workspace_ids.append(None)

        async with AsyncSessionLocal() as revision_session:
            for workspace_id in candidate_workspace_ids:
                revision = await GridRevisionService(SERVER_DEMO_TABLE, workspace_id=workspace_id).get_revision(
                    revision_session
                )
                if revision != "0":
                    return self._dataset_version(revision)
        return 0

    async def _read_history_status(self, request: ServerDemoHistoryStackRequest) -> GridHistoryStatus | None:
        status = await self._history.get_status(
            self._session,
            table_id=request.table_id,
            workspace_id=request.workspace_id or self._workspace_id,
            user_id=request.user_id,
            session_id=request.session_id,
        )
        return GridHistoryStatus(
            can_undo=status.can_undo,
            can_redo=status.can_redo,
            latest_undo_operation_id=status.latest_undo_operation_id,
            latest_redo_operation_id=status.latest_redo_operation_id,
        )

    def _history_response_fields(self, history_status: GridHistoryStatus | None) -> dict[str, Any]:
        if history_status is None:
            return {
                "can_undo": False,
                "can_redo": False,
                "latest_undo_operation_id": None,
                "latest_redo_operation_id": None,
            }
        return {
            "can_undo": history_status.can_undo,
            "can_redo": history_status.can_redo,
            "latest_undo_operation_id": history_status.latest_undo_operation_id,
            "latest_redo_operation_id": history_status.latest_redo_operation_id,
        }

    def _require_supported_history_table(self, table_id: str) -> None:
        if table_id == SERVER_DEMO_TABLE.table_id:
            return
        raise ApiException(
            status_code=404,
            code="table-not-found",
            message=f"History table {table_id} was not found",
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

    def _build_invalidation(
        self,
        *,
        operation_type: str,
        affected_indexes: list[int],
        committed: list[GridCommittedCell],
        fill_columns: list[str] | None = None,
    ) -> ServerDemoMutationInvalidation | None:
        if operation_type == "fill":
            if not affected_indexes:
                return self._dataset_invalidation()
            committed_columns = [column_id for column_id in (fill_columns or []) if column_id.strip()]
            sorted_columns = list(dict.fromkeys(committed_columns))
            range_payload = ServerDemoMutationRangeInvalidation(
                start_row=min(affected_indexes),
                end_row=max(affected_indexes),
                start_column=sorted_columns[0] if sorted_columns else None,
                end_column=sorted_columns[-1] if sorted_columns else None,
            )
            return ServerDemoMutationInvalidation(type="range", range=range_payload)

        if committed:
            cells = [
                ServerDemoMutationCellInvalidation(row_id=item.row_id, column_id=item.column_id)
                for item in committed
            ]
            if cells:
                return ServerDemoMutationInvalidation(type="cell", cells=cells)

        return self._dataset_invalidation()

    def _dataset_invalidation(self) -> ServerDemoMutationInvalidation:
        return ServerDemoMutationInvalidation(type="dataset")

    async def _read_current_revision_for_logging(self) -> str:
        revision = await self._revision.get_revision(self._session)
        if self._session.in_transaction():
            await self._session.rollback()
        return revision

    @staticmethod
    def _dataset_version(revision: str | None) -> int:
        return int(revision or 0)

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
