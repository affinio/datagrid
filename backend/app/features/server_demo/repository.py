from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import (
    ServerDemoHistogramEntry,
    ServerDemoHistogramResponse,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
    ServerDemoRow as ServerDemoRowSchema,
)

ALLOWED_SORT_COLUMNS = {
    "index": GridDemoRowModel.row_index,
    "name": GridDemoRowModel.name,
    "segment": GridDemoRowModel.segment,
    "status": GridDemoRowModel.status,
    "region": GridDemoRowModel.region,
    "value": GridDemoRowModel.value,
    "updatedAt": GridDemoRowModel.updated_at,
    "updated_at": GridDemoRowModel.updated_at,
}

ALLOWED_HISTOGRAM_COLUMNS = {"segment", "status", "region"}


class ServerDemoRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def health(self) -> None:
        await self._session.scalar(select(func.max(GridDemoRowModel.row_index)))

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse:
        conditions = self._build_filter_conditions(request.filter_model)
        stmt = self._build_filtered_row_query(conditions)
        stmt = stmt.order_by(*self._build_order_by(request.sort_model))
        stmt = stmt.offset(request.range.start_row).limit(request.range.end_row - request.range.start_row)

        rows = (await self._session.scalars(stmt)).all()
        total = await self._count_rows(conditions)
        revision = await self._revision_token(conditions)
        return ServerDemoPullResponse(
            rows=[self._to_row(row) for row in rows],
            total=total,
            revision=revision,
        )

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse:
        if column_id == "value":
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message="Value histograms are not implemented yet",
            )
        if column_id not in ALLOWED_HISTOGRAM_COLUMNS:
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message=f"Histogram is only supported for {sorted(ALLOWED_HISTOGRAM_COLUMNS)}",
            )

        column = getattr(GridDemoRowModel, column_id)
        conditions = self._build_filter_conditions(filter_model)
        stmt = (
            select(column, func.count())
            .select_from(GridDemoRowModel)
            .where(*conditions)
            .group_by(column)
            .order_by(column)
        )
        result = await self._session.execute(stmt)
        return ServerDemoHistogramResponse(
            column_id=column_id,
            entries=[ServerDemoHistogramEntry(value=value, count=count) for value, count in result.all()],
        )

    def _build_filtered_row_query(self, conditions: Sequence[Any]):
        return select(GridDemoRowModel).where(*conditions)

    async def _count_rows(self, conditions: Sequence[Any]) -> int:
        stmt = select(func.count()).select_from(GridDemoRowModel).where(*conditions)
        return int(await self._session.scalar(stmt) or 0)

    async def _revision_token(self, conditions: Sequence[Any]) -> str | None:
        stmt = select(func.max(GridDemoRowModel.updated_at)).where(*conditions)
        revision = await self._session.scalar(stmt)
        if revision is None:
            return None
        return revision.isoformat()

    def _build_order_by(self, sort_model: Sequence[Any]) -> list[Any]:
        order_by: list[Any] = []
        seen_columns: set[str] = set()

        for item in sort_model:
            column_id = self._sort_column_id(item)
            direction = self._sort_direction(item)
            if column_id is None or direction is None:
                continue

            column = ALLOWED_SORT_COLUMNS.get(column_id)
            if column is None:
                continue

            seen_columns.add(column_id)
            order_by.append(column.desc() if direction == "desc" else column.asc())

        if "index" not in seen_columns:
            order_by.append(GridDemoRowModel.row_index.asc())

        return order_by

    def _build_filter_conditions(self, filter_model: dict[str, Any] | None) -> list[Any]:
        if not filter_model:
            return []

        conditions: list[Any] = []

        for column_id, raw_filter in filter_model.items():
            if column_id in {"segment", "status", "region"}:
                value = self._extract_filter_value(raw_filter)
                if value is not None:
                    conditions.append(getattr(GridDemoRowModel, column_id) == value)
            elif column_id == "name":
                value = self._extract_filter_value(raw_filter)
                if value:
                    conditions.append(GridDemoRowModel.name.ilike(f"%{value}%"))
            elif column_id == "value":
                conditions.extend(self._build_value_conditions(raw_filter))

        return conditions

    def _build_value_conditions(self, raw_filter: Any) -> list[Any]:
        if not isinstance(raw_filter, dict):
            return []

        conditions: list[Any] = []
        min_value = raw_filter.get("min")
        max_value = raw_filter.get("max")
        if min_value is not None:
            conditions.append(GridDemoRowModel.value >= self._coerce_int(min_value))
        if max_value is not None:
            conditions.append(GridDemoRowModel.value <= self._coerce_int(max_value))

        filter_type = raw_filter.get("type")
        primary = raw_filter.get("filter")
        secondary = raw_filter.get("filterTo")

        if filter_type == "equals" and primary is not None:
            conditions.append(GridDemoRowModel.value == self._coerce_int(primary))
        elif filter_type == "greaterThan" and primary is not None:
            conditions.append(GridDemoRowModel.value > self._coerce_int(primary))
        elif filter_type == "greaterThanOrEqual" and primary is not None:
            conditions.append(GridDemoRowModel.value >= self._coerce_int(primary))
        elif filter_type == "lessThan" and primary is not None:
            conditions.append(GridDemoRowModel.value < self._coerce_int(primary))
        elif filter_type == "lessThanOrEqual" and primary is not None:
            conditions.append(GridDemoRowModel.value <= self._coerce_int(primary))
        elif filter_type == "inRange" and primary is not None and secondary is not None:
            conditions.append(GridDemoRowModel.value >= self._coerce_int(primary))
            conditions.append(GridDemoRowModel.value <= self._coerce_int(secondary))

        return conditions

    def _extract_filter_value(self, raw_filter: Any) -> Any:
        if isinstance(raw_filter, dict):
            if "filter" in raw_filter:
                return raw_filter["filter"]
            if "value" in raw_filter:
                return raw_filter["value"]
            if "values" in raw_filter and raw_filter["values"]:
                return raw_filter["values"][0]
            return None
        return raw_filter

    def _coerce_int(self, value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ApiException(
                status_code=400,
                code="invalid_filter",
                message="Numeric filters must contain integer values",
            ) from exc

    def _sort_column_id(self, item: Any) -> str | None:
        if hasattr(item, "resolved_column_id"):
            return item.resolved_column_id()
        if isinstance(item, dict):
            return item.get("colId") or item.get("key")
        return None

    def _sort_direction(self, item: Any) -> str | None:
        if hasattr(item, "resolved_direction"):
            direction = item.resolved_direction()
        elif isinstance(item, dict):
            direction = item.get("sort") or item.get("direction")
        else:
            direction = None

        if direction is None:
            return None
        normalized = str(direction).lower()
        if normalized not in {"asc", "desc"}:
            return None
        return normalized

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
