from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.history import (
    invalidate_redo_branch_for_scope,
    normalize_history_scope_value,
    operation_scope_from_request,
)
from app.features.server_demo.models import ServerDemoChangeEvent as ServerDemoChangeEventModel
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.features.server_demo.workspace import workspace_column_condition, workspace_scope_condition
from affino_grid_backend.core.mutations import GridHistoryStatus, PendingGridCellEvent
from affino_grid_backend.core.revision import GridRevisionService
from affino_grid_backend.edits import GridEditServiceBase

OPERATION_STATUS_APPLIED = "applied"


class ServerDemoEditService(GridEditServiceBase):
    def __init__(
        self,
        _columns: Mapping[str, Any] | None = None,
        revision_service: GridRevisionService | None = None,
        workspace_id: str | None = None,
        history_service: Any | None = None,
        *,
        max_batch_edits: int = 500,
    ):
        if revision_service is None:
            raise ValueError("revision_service is required")
        super().__init__(SERVER_DEMO_TABLE, revision_service, max_batch_edits=max_batch_edits)
        self._workspace_id = workspace_id
        self._history_service = history_service

    def normalize_edit_value(self, column_id: str, value: Any) -> Any:
        if column_id == "name" and value is None:
            raise ApiException(
                status_code=400,
                code="invalid-value",
                message="name edits must contain a string value",
            )
        return super().normalize_edit_value(column_id, value)

    async def fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
    ) -> dict[str, GridDemoRowModel]:
        if not row_ids:
            return {}
        stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids))
        scope_condition = workspace_scope_condition(SERVER_DEMO_TABLE, self._workspace_id)
        if scope_condition is not None:
            stmt = stmt.where(scope_condition)
        if with_for_update:
            stmt = stmt.with_for_update()
        rows = (await session.scalars(stmt)).all()
        return {row.id: row for row in rows}

    async def ensure_operation_id_available(self, session: AsyncSession, operation_id: str) -> None:
        conditions = [ServerDemoOperationModel.operation_id == operation_id]
        if self._workspace_id is not None:
            conditions.append(workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id))
        existing_count = await session.scalar(select(func.count()).select_from(ServerDemoOperationModel).where(*conditions))
        if existing_count:
            raise ApiException(
                status_code=409,
                code="duplicate-operation-id",
                message=f"Operation {operation_id} already exists",
            )

    async def create_operation(
        self,
        session: AsyncSession,
        operation_id: str,
        changed_at: datetime,
        request: Any,
    ) -> None:
        user_id, session_id = operation_scope_from_request(request)
        workspace_id = normalize_history_scope_value(getattr(request, "workspace_id", None))
        table_id = normalize_history_scope_value(getattr(request, "table_id", None)) or SERVER_DEMO_TABLE.table_id
        await invalidate_redo_branch_for_scope(
            session,
            workspace_id=workspace_id or self._workspace_id,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
            changed_at=changed_at,
        )
        session.add(
            ServerDemoOperationModel(
                operation_id=operation_id,
                workspace_id=workspace_id or self._workspace_id,
                table_id=table_id,
                user_id=user_id,
                session_id=session_id,
                operation_type="edit",
                status=OPERATION_STATUS_APPLIED,
                operation_metadata={},
                revision=changed_at,
                created_at=changed_at,
                modified_at=changed_at,
            )
        )

    async def create_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        cell_events: Sequence[PendingGridCellEvent],
        changed_at: datetime,
    ) -> None:
        session.add_all(
            [
                ServerDemoCellEventModel(
                    event_id=uuid4(),
                    operation_id=operation_id,
                    workspace_id=self._workspace_id,
                    row_id=cell_event.row.id,
                    column_key=cell_event.column_id,
                    before_value=cell_event.before_value,
                    after_value=cell_event.after_value,
                    created_at=changed_at,
                )
                for cell_event in cell_events
            ]
        )

    def set_row_value(self, row: GridDemoRowModel, column_id: str, value: Any) -> None:
        setattr(row, SERVER_DEMO_TABLE.model_attr(column_id), value)

    def get_row_value(self, row: GridDemoRowModel, column_id: str) -> Any:
        return getattr(row, SERVER_DEMO_TABLE.model_attr(column_id))

    def get_row_id(self, row: GridDemoRowModel) -> str:
        return row.id

    def get_row_index(self, row: GridDemoRowModel) -> int:
        return row.row_index

    def set_row_updated_at(self, row: GridDemoRowModel, changed_at: datetime) -> None:
        row.updated_at = changed_at

    def get_row_revision(self, row: GridDemoRowModel) -> str:
        return row.updated_at.isoformat()

    async def collect_history_status(
        self,
        session: AsyncSession,
        request: Any,
        *,
        operation_id: str | None,
        committed: list[Any],
        committed_row_ids: list[str],
        rejected: list[Any],
        affected_indexes: list[int],
        revision: str,
    ) -> GridHistoryStatus | None:
        if self._history_service is None:
            return None
        scope_workspace_id = normalize_history_scope_value(getattr(request, "workspace_id", None)) or self._workspace_id
        status = await self._history_service.get_status(
            session,
            table_id=normalize_history_scope_value(getattr(request, "table_id", None)) or SERVER_DEMO_TABLE.table_id,
            workspace_id=scope_workspace_id,
            user_id=normalize_history_scope_value(getattr(request, "user_id", None)),
            session_id=normalize_history_scope_value(getattr(request, "session_id", None)) or None,
        )
        if operation_id is not None and committed:
            session.add(
                ServerDemoChangeEventModel(
                    revision=int(revision),
                    workspace_id=scope_workspace_id,
                    table_id=SERVER_DEMO_TABLE.table_id,
                    operation_id=operation_id,
                    user_id=normalize_history_scope_value(getattr(request, "user_id", None)),
                    session_id=normalize_history_scope_value(getattr(request, "session_id", None)) or None,
                    change_type="cell",
                    invalidation={
                        "type": "cell",
                        "cells": [{"rowId": item.row_id, "columnId": item.column_id} for item in committed],
                        "rows": [],
                        "range": None,
                    },
                    created_at=datetime.now(timezone.utc),
                )
            )
        return GridHistoryStatus(
            can_undo=status.can_undo,
            can_redo=status.can_redo,
            latest_undo_operation_id=status.latest_undo_operation_id,
            latest_redo_operation_id=status.latest_redo_operation_id,
        )
