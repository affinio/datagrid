from __future__ import annotations

from typing import Any

from app.api.errors import ApiException
from app.features.server_demo.schemas import ServerDemoHistogramEntry, ServerDemoHistogramResponse
from app.grid.projection import GridProjectionService
from app.grid.table import GridTableDefinition
from sqlalchemy.ext.asyncio import AsyncSession


class ServerDemoProjectionService(GridProjectionService):
    def __init__(self, table: GridTableDefinition):
        super().__init__(
            model=table.model,
            columns=table.columns,
            default_sort_column_id=table.default_sort_column_id,
        )

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
