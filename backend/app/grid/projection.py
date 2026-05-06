from __future__ import annotations

import logging
import math
import re
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import Integer, cast, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.grid.columns import GridColumnDefinition, GridColumnRegistry
from app.grid.values import coerce_optional_int, normalize_filter_scalar

logger = logging.getLogger(__name__)
INTEGER_BUCKET_LABEL_PATTERN = re.compile(r"^(?P<start>[+-]?\d+)-(?P<end>[+-]?\d+)$")


class GridProjectionService:
    def __init__(
        self,
        *,
        model: type[Any],
        columns: GridColumnRegistry,
        default_sort_column_id: str = "index",
        max_histogram_buckets: int = 100,
        max_histogram_source_rows: int | None = None,
    ):
        self._model = model
        self._columns = columns
        self._default_sort_column_id = default_sort_column_id
        self._max_histogram_buckets = max(0, int(max_histogram_buckets))
        self._max_histogram_source_rows = max_histogram_source_rows

    def build_filter_conditions(self, filter_model: dict[str, Any] | None) -> list[Any]:
        if not filter_model:
            return []

        conditions: list[Any] = []
        for column_id, raw_filter in filter_model.items():
            definition = self._column_definition(column_id)
            if definition is None or not definition.filterable:
                continue

            column = getattr(self._model, definition.model_attr)
            if definition.value_type == "enum":
                values = self._extract_filter_values(raw_filter)
                if len(values) == 1:
                    conditions.append(column == values[0])
                elif len(values) > 1:
                    conditions.append(column.in_(values))
            elif definition.value_type == "integer":
                conditions.extend(self.build_integer_conditions(column, raw_filter))
            elif definition.value_type == "string":
                value = self._extract_filter_value(raw_filter)
                if value:
                    conditions.append(column.ilike(f"%{value}%"))

        return conditions

    def build_integer_conditions(self, column_attr: Any, raw_filter: Any) -> list[Any]:
        if not isinstance(raw_filter, dict):
            return self._build_integer_scalar_conditions(column_attr, raw_filter)

        if "values" in raw_filter:
            values = raw_filter["values"]
            if isinstance(values, (list, tuple, set)):
                return self._build_integer_set_conditions(column_attr, values)
            return []

        return self.build_value_conditions(column_attr, raw_filter)

    def build_value_conditions(self, column_attr: Any, raw_filter: Any) -> list[Any]:
        if not isinstance(raw_filter, dict):
            return self._build_integer_scalar_conditions(column_attr, raw_filter)

        conditions: list[Any] = []
        min_value = raw_filter.get("min")
        max_value = raw_filter.get("max")
        if min_value is not None:
            coerced_min = coerce_optional_int(min_value)
            if coerced_min is not None:
                conditions.append(column_attr >= coerced_min)
        if max_value is not None:
            coerced_max = coerce_optional_int(max_value)
            if coerced_max is not None:
                conditions.append(column_attr <= coerced_max)

        filter_type = raw_filter.get("type")
        primary = raw_filter.get("filter")
        secondary = raw_filter.get("filterTo")

        if filter_type == "equals" and primary is not None:
            condition = self._build_integer_term_condition(column_attr, primary)
            if condition is not None:
                conditions.append(condition)
        elif filter_type == "greaterThan" and primary is not None:
            coerced_primary = coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column_attr > coerced_primary)
        elif filter_type == "greaterThanOrEqual" and primary is not None:
            coerced_primary = coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column_attr >= coerced_primary)
        elif filter_type == "lessThan" and primary is not None:
            coerced_primary = coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column_attr < coerced_primary)
        elif filter_type == "lessThanOrEqual" and primary is not None:
            coerced_primary = coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(column_attr <= coerced_primary)
        elif filter_type == "inRange" and primary is not None and secondary is not None:
            coerced_primary = coerce_optional_int(primary)
            coerced_secondary = coerce_optional_int(secondary)
            if coerced_primary is not None and coerced_secondary is not None:
                conditions.append(column_attr >= coerced_primary)
                conditions.append(column_attr <= coerced_secondary)

        return conditions

    def _build_integer_scalar_conditions(self, column_attr: Any, raw_value: Any) -> list[Any]:
        condition = self._build_integer_term_condition(column_attr, raw_value)
        return [condition] if condition is not None else []

    def _build_integer_set_conditions(self, column_attr: Any, raw_values: Sequence[Any]) -> list[Any]:
        conditions = [
            condition
            for raw_value in raw_values
            if (condition := self._build_integer_term_condition(column_attr, raw_value)) is not None
        ]
        if not conditions:
            return []
        if len(conditions) == 1:
            return conditions
        return [or_(*conditions)]

    def _build_integer_term_condition(self, column_attr: Any, raw_value: Any) -> Any | None:
        normalized = normalize_filter_scalar(raw_value)
        if normalized is None:
            return None

        if isinstance(normalized, str):
            range_match = INTEGER_BUCKET_LABEL_PATTERN.fullmatch(normalized)
            if range_match is not None:
                start = int(range_match.group("start"))
                end = int(range_match.group("end"))
                if start > end:
                    raise ApiException(
                        status_code=400,
                        code="invalid_filter",
                        message="Numeric filters must contain integer values",
                    )
                return column_attr.between(start, end)

        try:
            return column_attr == int(normalized)
        except (TypeError, ValueError) as exc:
            raise ApiException(
                status_code=400,
                code="invalid_filter",
                message="Numeric filters must contain integer values",
            ) from exc

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
            column = getattr(self._model, definition.model_attr)
            order_by.append(column.desc() if direction == "desc" else column.asc())

        if self._default_sort_column_id not in seen_columns:
            definition = self._column_definition(self._default_sort_column_id)
            if definition is not None:
                order_by.append(getattr(self._model, definition.model_attr).asc())

        return order_by

    def build_row_query(self, conditions: Sequence[Any]):
        return select(self._model).where(*conditions)

    async def count_rows(self, session: AsyncSession, conditions: Sequence[Any]) -> int:
        stmt = select(func.count()).select_from(self._model).where(*conditions)
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
        return await self._histogram_entries_for_definition(
            session,
            column_id=column_id,
            definition=definition,
            column=column,
            query_conditions=conditions,
            matching_row_conditions=conditions,
        )

    async def _histogram_entries_for_definition(
        self,
        session: AsyncSession,
        *,
        column_id: str,
        definition: GridColumnDefinition,
        column: Any,
        query_conditions: Sequence[Any],
        matching_row_conditions: Sequence[Any] | None = None,
    ) -> list[tuple[Any, int]]:
        source_conditions = list(matching_row_conditions if matching_row_conditions is not None else query_conditions)
        if self._max_histogram_source_rows is not None:
            matching_rows = await self.count_rows(session, source_conditions)
            if matching_rows > self._max_histogram_source_rows:
                raise ApiException(
                    status_code=400,
                    code="histogram-source-too-large",
                    message="Histogram source row count exceeds maximum allowed size",
                )

        if definition.value_type == "integer":
            return await self._integer_histogram_entries(session, column_id, column, query_conditions)

        stmt = (
            select(column, func.count())
            .select_from(self._model)
            .where(*query_conditions)
            .group_by(column)
            .order_by(column)
        )
        result = await session.execute(stmt)
        entries = [(value, count) for value, count in result.all()]
        if len(entries) > self._max_histogram_buckets:
            logger.warning(
                "histogram-truncated column_id=%s bucket_count=%s max_buckets=%s",
                column_id,
                len(entries),
                self._max_histogram_buckets,
            )
            return entries[: self._max_histogram_buckets]
        return entries

    async def _integer_histogram_entries(
        self,
        session: AsyncSession,
        column_id: str,
        column: Any,
        conditions: Sequence[Any],
    ) -> list[tuple[Any, int]]:
        if self._max_histogram_buckets <= 0:
            return []

        non_null_conditions = [*conditions, column.is_not(None)]
        aggregate_stmt = (
            select(func.min(column), func.max(column), func.count(column))
            .select_from(self._model)
            .where(*non_null_conditions)
        )
        aggregate_result = await session.execute(aggregate_stmt)
        min_value, max_value, non_null_count = aggregate_result.one()

        if min_value is None or max_value is None or not non_null_count:
            return []

        bucket_count = min(self._max_histogram_buckets, int(non_null_count))
        if bucket_count <= 0:
            return []

        value_range = int(max_value) - int(min_value) + 1
        bucket_width = max(1, math.ceil(value_range / bucket_count))
        bucket_index = cast(func.floor((column - literal(int(min_value))) / literal(bucket_width)), Integer)
        grouped_stmt = (
            select(bucket_index, func.count())
            .select_from(self._model)
            .where(*non_null_conditions)
            .group_by(bucket_index)
            .order_by(bucket_index)
        )
        result = await session.execute(grouped_stmt)

        entries: list[tuple[Any, int]] = []
        for raw_bucket_index, count in result.all():
            bucket_index_value = int(raw_bucket_index)
            start = int(min_value) + (bucket_index_value * bucket_width)
            end = min(start + bucket_width - 1, int(max_value))
            entries.append((f"{start}-{end}", int(count)))

        return entries

    def _column_definition(self, column_id: str) -> GridColumnDefinition | None:
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
                values = [normalize_filter_scalar(value) for value in raw_filter["values"]]
                return [value for value in values if value is not None]
            if "filter" in raw_filter:
                value = normalize_filter_scalar(raw_filter["filter"])
                return [value] if value is not None else []
            if "value" in raw_filter:
                value = normalize_filter_scalar(raw_filter["value"])
                return [value] if value is not None else []
            if "tokens" in raw_filter and isinstance(raw_filter["tokens"], (list, tuple, set)):
                values = [normalize_filter_scalar(value) for value in raw_filter["tokens"]]
                return [value for value in values if value is not None]
            return []
        if isinstance(raw_filter, (list, tuple, set)):
            values = [normalize_filter_scalar(value) for value in raw_filter]
            return [value for value in values if value is not None]
        value = normalize_filter_scalar(raw_filter)
        return [value] if value is not None else []

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
