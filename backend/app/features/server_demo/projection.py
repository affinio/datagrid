from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.columns import ServerDemoColumnDefinition
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import ServerDemoHistogramEntry, ServerDemoHistogramResponse


class ServerDemoProjectionService:
    def __init__(self, columns: Mapping[str, ServerDemoColumnDefinition]):
        self._columns = columns

    def build_filter_conditions(self, filter_model: dict[str, Any] | None) -> list[Any]:
        if not filter_model:
            return []

        conditions: list[Any] = []
        for column_id, raw_filter in filter_model.items():
            definition = self._column_definition(column_id)
            if definition is None or not definition.filterable:
                continue

            column = getattr(GridDemoRowModel, definition.model_attr)
            if definition.value_type == "enum":
                values = self._extract_filter_values(raw_filter)
                if len(values) == 1:
                    conditions.append(column == values[0])
                elif len(values) > 1:
                    conditions.append(column.in_(values))
            elif definition.value_type == "integer":
                conditions.extend(self.build_value_conditions(raw_filter))
            elif column_id == "name":
                value = self._extract_filter_value(raw_filter)
                if value:
                    conditions.append(column.ilike(f"%{value}%"))

        return conditions

    def build_value_conditions(self, raw_filter: Any) -> list[Any]:
        if not isinstance(raw_filter, dict):
            return []

        column = GridDemoRowModel.value
        conditions: list[Any] = []
        min_value = raw_filter.get("min")
        max_value = raw_filter.get("max")
        if min_value is not None:
            coerced_min = self._coerce_optional_int(min_value)
            if coerced_min is not None:
                conditions.append(column >= coerced_min)
        if max_value is not None:
            coerced_max = self._coerce_optional_int(max_value)
            if coerced_max is not None:
                conditions.append(column <= coerced_max)

        filter_type = raw_filter.get("type")
        primary = raw_filter.get("filter")
        secondary = raw_filter.get("filterTo")

        if filter_type == "equals" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column == coerced_primary)
        elif filter_type == "greaterThan" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column > coerced_primary)
        elif filter_type == "greaterThanOrEqual" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column >= coerced_primary)
        elif filter_type == "lessThan" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column < coerced_primary)
        elif filter_type == "lessThanOrEqual" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column <= coerced_primary)
        elif filter_type == "inRange" and primary is not None and secondary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            coerced_secondary = self._coerce_optional_int(secondary)
            if coerced_primary is not None and coerced_secondary is not None:
                conditions.append(column >= coerced_primary)
                conditions.append(column <= coerced_secondary)

        return conditions

    def build_order_by(self, sort_model: Sequence[Any]) -> list[Any]:
        order_by: list[Any] = []
        seen_columns: set[str] = set()

        for item in sort_model:
            column_id = self._sort_column_id(item)
            direction = self._sort_direction(item)
            if column_id is None or direction is None:
                continue

            definition = self._column_definition(column_id)
            if definition is None or not definition.sortable:
                continue

            seen_columns.add(column_id)
            column = getattr(GridDemoRowModel, definition.model_attr)
            order_by.append(column.desc() if direction == "desc" else column.asc())

        if "index" not in seen_columns:
            order_by.append(GridDemoRowModel.row_index.asc())

        return order_by

    def build_row_query(self, conditions: Sequence[Any]):
        return select(GridDemoRowModel).where(*conditions)

    async def count_rows(self, session: AsyncSession, conditions: Sequence[Any]) -> int:
        stmt = select(func.count()).select_from(GridDemoRowModel).where(*conditions)
        return int(await session.scalar(stmt) or 0)

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

        column = getattr(GridDemoRowModel, definition.model_attr)
        conditions = self.build_filter_conditions(filter_model)
        stmt = (
            select(column, func.count())
            .select_from(GridDemoRowModel)
            .where(*conditions)
            .group_by(column)
            .order_by(column)
        )
        result = await session.execute(stmt)
        return ServerDemoHistogramResponse(
            column_id=column_id,
            entries=[ServerDemoHistogramEntry(value=value, count=count) for value, count in result.all()],
        )

    def _column_definition(self, column_id: str) -> ServerDemoColumnDefinition | None:
        return self._columns.get(column_id)

    def _supported_histogram_columns(self) -> list[str]:
        return sorted(definition.id for definition in self._columns.values() if definition.histogram)

    def _extract_filter_value(self, raw_filter: Any) -> Any:
        values = self._extract_filter_values(raw_filter)
        if not values:
            return None
        return values[0]

    def _extract_filter_values(self, raw_filter: Any) -> list[Any]:
        if isinstance(raw_filter, dict):
            if "values" in raw_filter and isinstance(raw_filter["values"], (list, tuple, set)):
                values = [self._normalize_filter_scalar(value) for value in raw_filter["values"]]
                return [value for value in values if value is not None]
            if "filter" in raw_filter:
                value = self._normalize_filter_scalar(raw_filter["filter"])
                return [value] if value is not None else []
            if "value" in raw_filter:
                value = self._normalize_filter_scalar(raw_filter["value"])
                return [value] if value is not None else []
            if "tokens" in raw_filter and isinstance(raw_filter["tokens"], (list, tuple, set)):
                values = [self._normalize_filter_scalar(value) for value in raw_filter["tokens"]]
                return [value for value in values if value is not None]
            return []
        if isinstance(raw_filter, (list, tuple, set)):
            values = [self._normalize_filter_scalar(value) for value in raw_filter]
            return [value for value in values if value is not None]
        value = self._normalize_filter_scalar(raw_filter)
        return [value] if value is not None else []

    def _normalize_filter_scalar(self, value: Any) -> Any | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return None
            if normalized.startswith("string:"):
                normalized = normalized[len("string:") :]
            elif normalized.startswith("number:"):
                normalized = normalized[len("number:") :]
            elif normalized == "null":
                return None
            elif normalized == "boolean:true":
                return True
            elif normalized == "boolean:false":
                return False
            elif normalized.startswith("date:"):
                normalized = normalized[len("date:") :]
            return normalized if normalized else None
        return value

    def _coerce_optional_int(self, value: Any) -> int | None:
        normalized = self._normalize_filter_scalar(value)
        if normalized is None:
            return None
        try:
            return int(normalized)
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
