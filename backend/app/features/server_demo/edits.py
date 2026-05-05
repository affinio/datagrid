from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.features.server_demo.workspace import workspace_column_condition, workspace_scope_condition
from app.grid.edits import GridEditServiceBase
from app.grid.mutations import PendingGridCellEvent
from app.grid.revision import GridRevisionService

OPERATION_STATUS_APPLIED = "applied"


class ServerDemoEditService(GridEditServiceBase):
    def __init__(
        self,
        _columns: Mapping[str, Any] | None = None,
        revision_service: GridRevisionService | None = None,
        workspace_id: str | None = None,
    ):
        if revision_service is None:
            raise ValueError("revision_service is required")
        super().__init__(SERVER_DEMO_TABLE, revision_service)
        self._workspace_id = workspace_id

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
        existing_count = await session.scalar(
            select(func.count())
            .select_from(ServerDemoOperationModel)
            .where(
                ServerDemoOperationModel.operation_id == operation_id,
                workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id),
            )
        )
        if existing_count:
            raise ApiException(
                status_code=409,
                code="duplicate-operation-id",
                message=f"Operation {operation_id} already exists",
            )

    async def create_operation(self, session: AsyncSession, operation_id: str, changed_at: datetime) -> None:
        session.add(
            ServerDemoOperationModel(
                operation_id=operation_id,
                workspace_id=self._workspace_id,
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
