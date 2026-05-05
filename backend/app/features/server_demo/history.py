from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.features.server_demo.workspace import workspace_column_condition, workspace_scope_condition
from app.grid.history import GridHistoryServiceBase
from app.grid.mutations import GridHistoryApplyResult
from app.grid.revision import GridRevisionService


class ServerDemoHistoryService(GridHistoryServiceBase):
    def __init__(
        self,
        columns: Mapping[str, Any],
        revision_service: GridRevisionService | None = None,
        workspace_id: str | None = None,
    ):
        if revision_service is None:
            raise ValueError("revision_service is required")
        super().__init__(SERVER_DEMO_TABLE, revision_service)
        self._columns = columns
        self._workspace_id = workspace_id

    async def undo_operation(self, session: AsyncSession, operation_id: str) -> GridHistoryApplyResult:
        return await self.apply_operation(session, operation_id, "undo")

    async def redo_operation(self, session: AsyncSession, operation_id: str) -> GridHistoryApplyResult:
        return await self.apply_operation(session, operation_id, "redo")

    async def get_operation(self, session: AsyncSession, operation_id: str, *, with_for_update: bool = False) -> Any:
        stmt = select(ServerDemoOperationModel).where(
            ServerDemoOperationModel.operation_id == operation_id,
            workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id),
        )
        if with_for_update:
            stmt = stmt.with_for_update()
        return await session.scalar(stmt)

    def get_operation_id(self, operation: Any) -> str:
        return operation.operation_id

    def get_operation_type(self, operation: Any) -> str:
        return operation.operation_type

    def get_operation_status(self, operation: Any) -> str:
        return operation.status

    def set_operation_status(self, operation: Any, status: str) -> None:
        operation.status = status

    def set_operation_modified_at(self, operation: Any, changed_at: datetime) -> None:
        operation.modified_at = changed_at

    def set_operation_revision(self, operation: Any, changed_at: datetime) -> None:
        operation.revision = changed_at

    async def load_cell_events(self, session: AsyncSession, operation_id: str) -> Sequence[Any]:
        return (
            await session.scalars(
                select(ServerDemoCellEventModel)
                .where(
                    ServerDemoCellEventModel.operation_id == operation_id,
                    workspace_column_condition(ServerDemoCellEventModel.workspace_id, self._workspace_id),
                )
                .order_by(ServerDemoCellEventModel.created_at.asc(), ServerDemoCellEventModel.event_id.asc())
            )
        ).all()

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

    def event_row_id(self, event: Any) -> str:
        return event.row_id

    def event_column_id(self, event: Any) -> str:
        return event.column_key

    def event_before_value(self, event: Any) -> Any:
        return event.before_value

    def event_after_value(self, event: Any) -> Any:
        return event.after_value

    def get_row_value(self, row: GridDemoRowModel, column_id: str) -> Any:
        return getattr(row, SERVER_DEMO_TABLE.model_attr(column_id))

    def set_row_value(self, row: GridDemoRowModel, column_id: str, value: Any) -> None:
        setattr(row, SERVER_DEMO_TABLE.model_attr(column_id), value)

    def set_row_updated_at(self, row: GridDemoRowModel, changed_at: datetime) -> None:
        row.updated_at = changed_at

    def get_row_id(self, row: GridDemoRowModel) -> str:
        return row.id

    def get_row_index(self, row: GridDemoRowModel) -> int:
        return row.row_index

    def get_row_revision(self, row: GridDemoRowModel) -> str:
        return row.updated_at.isoformat()
