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
from app.features.server_demo.projection import ServerDemoProjectionService
from app.features.server_demo.schemas import ServerDemoFillBoundaryRequest, ServerDemoFillBoundaryResponse
from app.features.server_demo.table import SERVER_DEMO_TABLE
from app.grid.fill import GridFillServiceBase
from app.grid.mutations import PendingGridCellEvent
from app.grid.revision import GridRevisionService

OPERATION_STATUS_APPLIED = "applied"


class ServerDemoFillService(GridFillServiceBase):
    def __init__(
        self,
        _columns: Mapping[str, Any],
        projection: ServerDemoProjectionService,
        revision_service: GridRevisionService | None = None,
    ):
        if revision_service is None:
            raise ValueError("revision_service is required")
        super().__init__(SERVER_DEMO_TABLE, revision_service)
        self._projection = projection

    async def resolve_boundary(
        self,
        session: AsyncSession,
        request: ServerDemoFillBoundaryRequest,
    ) -> ServerDemoFillBoundaryResponse:
        return ServerDemoFillBoundaryResponse(**(await super().resolve_boundary(session, request)))

    def build_projected_query(self, session: AsyncSession, projection: Any) -> Any:
        return self._build_projected_query(projection)

    async def count_projected_rows(self, session: AsyncSession, projection: Any) -> int:
        conditions = self._projection.build_filter_conditions(projection.filter_model)
        return await self._projection.count_rows(session, conditions)

    async def fetch_projected_rows(
        self,
        session: AsyncSession,
        projection: Any,
        start_index: int,
        limit: int,
    ) -> list[GridDemoRowModel]:
        stmt = self._build_projected_query(projection).offset(start_index).limit(limit)
        return (await session.scalars(stmt)).all()

    async def fetch_projected_row(self, session: AsyncSession, projection: Any, row_index: int) -> GridDemoRowModel | None:
        if row_index < 0:
            return None
        stmt = self._build_projected_query(projection).offset(row_index).limit(1)
        rows = (await session.scalars(stmt)).all()
        return rows[0] if rows else None

    async def fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
    ) -> dict[str, GridDemoRowModel]:
        if not row_ids:
            return {}
        stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(list(row_ids)))
        if with_for_update:
            stmt = stmt.with_for_update()
        rows = (await session.scalars(stmt)).all()
        return {row.id: row for row in rows}

    async def ensure_operation_id_available(self, session: AsyncSession, operation_id: str) -> None:
        existing_count = await session.scalar(
            select(func.count())
            .select_from(ServerDemoOperationModel)
            .where(ServerDemoOperationModel.operation_id == operation_id)
        )
        if existing_count:
            raise ApiException(
                status_code=409,
                code="duplicate-operation-id",
                message=f"Operation {operation_id} already exists",
            )

    async def create_fill_operation(
        self,
        session: AsyncSession,
        operation_id: str,
        metadata: dict[str, Any],
        changed_at: datetime,
    ) -> None:
        session.add(
            ServerDemoOperationModel(
                operation_id=operation_id,
                operation_type="fill",
                status=OPERATION_STATUS_APPLIED,
                operation_metadata=metadata,
                revision=changed_at,
                created_at=changed_at,
                modified_at=changed_at,
            )
        )

    async def create_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        pending_events: Sequence[PendingGridCellEvent],
        changed_at: datetime,
    ) -> None:
        session.add_all(
            [
                ServerDemoCellEventModel(
                    event_id=uuid4(),
                    operation_id=operation_id,
                    row_id=cell_event.row.id,
                    column_key=cell_event.column_id,
                    before_value=cell_event.before_value,
                    after_value=cell_event.after_value,
                    created_at=changed_at,
                )
                for cell_event in pending_events
                if cell_event.before_value != cell_event.after_value
            ]
        )

    def normalize_fill_value(self, column_id: str, value: Any) -> Any:
        if column_id == "name" and value is None:
            raise ApiException(
                status_code=400,
                code="invalid-value",
                message="name edits must contain a string value",
            )
        return super().normalize_fill_value(column_id, value)

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

    def _build_projected_query(self, projection: Any) -> Any:
        conditions = self._projection.build_filter_conditions(projection.filter_model)
        stmt = self._projection.build_row_query(conditions)
        return stmt.order_by(*self._projection.build_order_by(projection.sort_model))
