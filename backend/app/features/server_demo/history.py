from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.features.server_demo.workspace import workspace_column_condition, workspace_scope_condition
from affino_grid_backend.core.mutations import GridHistoryApplyResult
from affino_grid_backend.core.revision import GridRevisionService
from affino_grid_backend.history import GridHistoryServiceBase

DEFAULT_SERVER_DEMO_WORKSPACE_ID = "server-demo-sandbox"
DEFAULT_SERVER_DEMO_SESSION_ID = "server-demo-session"
OPERATION_STATUS_APPLIED = "applied"
OPERATION_STATUS_DISCARDED = "discarded"
OPERATION_STATUS_UNDONE = "undone"


@dataclass(frozen=True)
class ServerDemoHistoryStatus:
    can_undo: bool
    can_redo: bool
    latest_undo_operation_id: str | None
    latest_redo_operation_id: str | None


def normalize_history_scope_value(value: str | None) -> str | None:
    normalized = value.strip() if value else ""
    return normalized or None


def operation_scope_from_request(request: Any) -> tuple[str | None, str | None]:
    user_id = normalize_history_scope_value(getattr(request, "user_id", None))
    session_id = normalize_history_scope_value(getattr(request, "session_id", None))
    if user_id is None and session_id is None:
        session_id = DEFAULT_SERVER_DEMO_SESSION_ID
    return user_id, session_id


def _operation_scope_conditions(
    model: type[ServerDemoOperationModel],
    *,
    user_id: str | None,
    session_id: str | None,
) -> list[Any]:
    conditions: list[Any] = []
    if user_id is not None:
        conditions.append(model.user_id == user_id)
    if session_id is not None:
        conditions.append(model.session_id == session_id)
    return conditions


async def invalidate_redo_branch_for_scope(
    session: AsyncSession,
    *,
    workspace_id: str | None,
    changed_at: datetime,
    table_id: str | None = SERVER_DEMO_TABLE.table_id,
    user_id: str | None = None,
    session_id: str | None = None,
) -> None:
    conditions = [
        workspace_column_condition(ServerDemoOperationModel.workspace_id, workspace_id),
        ServerDemoOperationModel.table_id == table_id,
        ServerDemoOperationModel.status == OPERATION_STATUS_UNDONE,
        *_operation_scope_conditions(ServerDemoOperationModel, user_id=user_id, session_id=session_id),
    ]
    await session.execute(
        update(ServerDemoOperationModel)
        .where(*conditions)
        .values(
            status=OPERATION_STATUS_DISCARDED,
            modified_at=changed_at,
        )
    )


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
        self._table_id = SERVER_DEMO_TABLE.table_id

    async def undo_operation(self, session: AsyncSession, operation_id: str) -> GridHistoryApplyResult:
        return await self.apply_operation(session, operation_id, "undo")

    async def redo_operation(self, session: AsyncSession, operation_id: str) -> GridHistoryApplyResult:
        return await self.apply_operation(session, operation_id, "redo")

    async def undo_latest_operation(
        self,
        session: AsyncSession,
        *,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> GridHistoryApplyResult:
        return await self._apply_latest_operation(
            session,
            action="undo",
            status=OPERATION_STATUS_APPLIED,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
        )

    async def redo_latest_operation(
        self,
        session: AsyncSession,
        *,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> GridHistoryApplyResult:
        return await self._apply_latest_operation(
            session,
            action="redo",
            status=OPERATION_STATUS_UNDONE,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
        )

    async def can_undo(
        self,
        session: AsyncSession,
        *,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> bool:
        return await self._has_operation_with_status(
            session,
            status=OPERATION_STATUS_APPLIED,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
        )

    async def can_redo(
        self,
        session: AsyncSession,
        *,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> bool:
        return await self._has_operation_with_status(
            session,
            status=OPERATION_STATUS_UNDONE,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
        )

    async def get_status(
        self,
        session: AsyncSession,
        *,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> ServerDemoHistoryStatus:
        latest_undo = await self._latest_operation_by_status(
            session,
            status=OPERATION_STATUS_APPLIED,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
            with_for_update=False,
        )
        latest_redo = await self._latest_operation_by_status(
            session,
            status=OPERATION_STATUS_UNDONE,
            table_id=table_id,
            user_id=user_id,
            session_id=session_id,
            with_for_update=False,
        )
        return ServerDemoHistoryStatus(
            can_undo=latest_undo is not None,
            can_redo=latest_redo is not None,
            latest_undo_operation_id=latest_undo.operation_id if latest_undo is not None else None,
            latest_redo_operation_id=latest_redo.operation_id if latest_redo is not None else None,
        )

    async def _apply_latest_operation(
        self,
        session: AsyncSession,
        *,
        action: Literal["undo", "redo"],
        status: str,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> GridHistoryApplyResult:
        async with session.begin():
            operation = await self._latest_operation_by_status(
                session,
                status=status,
                table_id=table_id,
                user_id=user_id,
                session_id=session_id,
                with_for_update=True,
            )
            if operation is None:
                raise ApiException(
                    status_code=409,
                    code=f"no-{action}-available",
                    message=f"No {action} operation is available",
                )
            return await self.apply_loaded_operation(session, operation, action)

    async def _has_operation_with_status(
        self,
        session: AsyncSession,
        *,
        status: str,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> bool:
        conditions = [
            ServerDemoOperationModel.table_id == table_id,
            ServerDemoOperationModel.status == status,
            *_operation_scope_conditions(ServerDemoOperationModel, user_id=user_id, session_id=session_id),
        ]
        if self._workspace_id is not None:
            conditions.insert(0, workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id))
        count = await session.scalar(
            select(func.count())
            .select_from(ServerDemoOperationModel)
            .where(*conditions)
        )
        return bool(count)

    async def _latest_operation_by_status(
        self,
        session: AsyncSession,
        *,
        status: str,
        table_id: str | None = SERVER_DEMO_TABLE.table_id,
        user_id: str | None = None,
        session_id: str | None = None,
        with_for_update: bool = False,
    ) -> Any:
        conditions = [
            ServerDemoOperationModel.table_id == table_id,
            ServerDemoOperationModel.status == status,
            *_operation_scope_conditions(ServerDemoOperationModel, user_id=user_id, session_id=session_id),
        ]
        if self._workspace_id is not None:
            conditions.insert(0, workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id))
        stmt = (
            select(ServerDemoOperationModel)
            .where(*conditions)
            .order_by(
                ServerDemoOperationModel.modified_at.desc()
                if status == OPERATION_STATUS_UNDONE
                else ServerDemoOperationModel.created_at.desc(),
                ServerDemoOperationModel.id.desc(),
            )
            .limit(1)
        )
        if with_for_update:
            stmt = stmt.with_for_update()
        return await session.scalar(stmt)

    async def get_operation(self, session: AsyncSession, operation_id: str, *, with_for_update: bool = False) -> Any:
        conditions = [
            ServerDemoOperationModel.operation_id == operation_id,
            ServerDemoOperationModel.table_id == self._table_id,
        ]
        if self._workspace_id is not None:
            conditions.append(workspace_column_condition(ServerDemoOperationModel.workspace_id, self._workspace_id))
        stmt = select(ServerDemoOperationModel).where(*conditions)
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

    async def load_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        *,
        workspace_id: str | None = None,
        table_id: str | None = None,
        force_unscoped: bool = False,
    ) -> Sequence[Any]:
        conditions = [ServerDemoCellEventModel.operation_id == operation_id]
        scoped_workspace_id = None if force_unscoped else (workspace_id if workspace_id is not None else self._workspace_id)
        if scoped_workspace_id is not None:
            conditions.append(workspace_column_condition(ServerDemoCellEventModel.workspace_id, scoped_workspace_id))
        return (
            await session.scalars(
                select(ServerDemoCellEventModel)
                .where(*conditions)
                .order_by(ServerDemoCellEventModel.created_at.asc(), ServerDemoCellEventModel.event_id.asc())
            )
        ).all()

    async def fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
        workspace_id: str | None = None,
        table_id: str | None = None,
        force_unscoped: bool = False,
    ) -> dict[str, GridDemoRowModel]:
        if not row_ids:
            return {}
        stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids))
        if not force_unscoped:
            scoped_workspace_id = workspace_id if workspace_id is not None else self._workspace_id
            scope_condition = workspace_scope_condition(SERVER_DEMO_TABLE, scoped_workspace_id)
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
