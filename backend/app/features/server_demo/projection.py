from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.schemas import ServerDemoHistogramEntry, ServerDemoHistogramResponse
from app.features.server_demo.workspace import workspace_scope_condition
from app.grid.projection import GridProjectionService
from app.grid.table import GridTableDefinition


class ServerDemoProjectionService(GridProjectionService):
    def __init__(
        self,
        table: GridTableDefinition,
        workspace_id: str | None = None,
        *,
        max_histogram_buckets: int = 100,
    ):
        super().__init__(
            model=table.model,
            columns=table.columns,
            default_sort_column_id=table.default_sort_column_id,
            max_histogram_buckets=max_histogram_buckets,
        )
        self._table = table
        self._workspace_id = workspace_id

    def build_row_query(self, conditions: list[Any]):
        scope_condition = workspace_scope_condition(self._table, self._workspace_id)
        scoped_conditions = [*conditions]
        if scope_condition is not None:
            scoped_conditions.append(scope_condition)
        return super().build_row_query(scoped_conditions)

    async def count_rows(self, session: AsyncSession, conditions: list[Any]) -> int:
        scope_condition = workspace_scope_condition(self._table, self._workspace_id)
        scoped_conditions = [*conditions]
        if scope_condition is not None:
            scoped_conditions.append(scope_condition)
        stmt = select(func.count()).select_from(self._model).where(*scoped_conditions)
        return int(await session.scalar(stmt) or 0)

    async def histogram_entries(
        self,
        session: AsyncSession,
        column_id: str,
        filter_model: dict[str, Any] | None,
    ) -> list[tuple[Any, int]]:
        definition = self._column_definition(column_id)
        if definition is None:
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message=f"Histogram is only supported for {self._supported_histogram_columns()}",
            )

        column = getattr(self._model, definition.model_attr)
        conditions = self.build_filter_conditions(filter_model)
        scope_condition = workspace_scope_condition(self._table, self._workspace_id)
        scoped_conditions = [*conditions]
        if scope_condition is not None:
            scoped_conditions.append(scope_condition)
        stmt = (
            select(column, func.count())
            .select_from(self._model)
            .where(*scoped_conditions)
            .group_by(column)
            .order_by(column)
        )
        result = await session.execute(stmt)
        return [(value, count) for value, count in result.all()]

    async def histogram(
        self,
        session: AsyncSession,
        column_id: str,
        filter_model: dict[str, Any] | None,
    ) -> ServerDemoHistogramResponse:
        if column_id == "value":
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message="Value histograms are not implemented yet",
            )

        definition = self._column_definition(column_id)
        if definition is None or not definition.histogram:
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message=f"Histogram is only supported for {self._supported_histogram_columns()}",
            )

        entries = await self.histogram_entries(session, column_id, filter_model)
        return ServerDemoHistogramResponse(
            column_id=column_id,
            entries=[ServerDemoHistogramEntry(value=value, count=count) for value, count in entries],
        )
