from __future__ import annotations

import logging
import math
import re
from datetime import datetime
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import Integer, String, and_, cast, func, literal, not_, or_, select
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
        for column_id, raw_filter in self._iter_filter_model_columns(filter_model):
            definition = self._column_definition(column_id)
            if definition is None or not definition.filterable:
                continue

            column = getattr(self._model, definition.model_attr)
            conditions.extend(self._build_column_filter_conditions(definition, column, raw_filter))

        advanced_expression = self._resolve_advanced_expression(filter_model)
        if advanced_expression is not None:
            advanced_condition = self._build_advanced_expression_condition(advanced_expression)
            if advanced_condition is not None:
                conditions.append(advanced_condition)

        return conditions

    def _iter_filter_model_columns(self, filter_model: dict[str, Any]) -> Sequence[tuple[str, Any]]:
        column_filters = filter_model.get("columnFilters")
        if isinstance(column_filters, Mapping):
            return tuple((str(column_id), raw_filter) for column_id, raw_filter in column_filters.items())

        control_keys = {"advancedExpression", "advancedFilters", "columnStyleFilters"}
        return tuple(
            (str(column_id), raw_filter)
            for column_id, raw_filter in filter_model.items()
            if column_id not in control_keys
        )

    def _build_column_filter_conditions(
        self,
        definition: GridColumnDefinition,
        column: Any,
        raw_filter: Any,
    ) -> list[Any]:
        if isinstance(raw_filter, dict):
            kind = str(raw_filter.get("kind") or "").strip().lower()
            if kind == "valueSet".lower():
                return self._build_value_set_filter_conditions(definition, column, raw_filter.get("tokens"))
            if kind == "predicate":
                return self._build_predicate_filter_conditions(definition, column, raw_filter)

        if definition.value_type == "enum":
            values = self._extract_filter_values(raw_filter)
            if len(values) == 1:
                return [self._build_text_equals_condition(column, values[0])]
            if len(values) > 1:
                return [self._build_text_in_condition(column, values)]
            return []
        if definition.value_type == "integer":
            return self.build_integer_conditions(column, raw_filter)
        if definition.value_type == "datetime":
            return self._build_datetime_filter_conditions(column, raw_filter)
        if definition.value_type == "string":
            value = self._extract_filter_value(raw_filter)
            if value:
                return [self._build_text_contains_condition(column, value)]
        return []

    def _build_value_set_filter_conditions(
        self,
        definition: GridColumnDefinition,
        column: Any,
        raw_values: Any,
    ) -> list[Any]:
        if definition.value_type == "integer":
            return self.build_integer_conditions(column, {"values": raw_values})

        values = self._extract_filter_values({"values": raw_values})
        if len(values) == 1:
            return [self._build_text_equals_condition(column, values[0])]
        if len(values) > 1:
            return [self._build_text_in_condition(column, values)]
        return []

    def _build_predicate_filter_conditions(
        self,
        definition: GridColumnDefinition,
        column: Any,
        raw_filter: Mapping[str, Any],
    ) -> list[Any]:
        operator = str(raw_filter.get("operator") or "").strip().lower()
        value = raw_filter.get("value")
        value2 = raw_filter.get("value2")

        if definition.value_type == "integer":
            return self._build_numeric_predicate_conditions(column, operator, value, value2)
        if definition.value_type == "datetime":
            return self._build_datetime_predicate_conditions(column, operator, value, value2)
        return self._build_text_predicate_conditions(column, operator, value, value2)

    def _build_text_predicate_conditions(
        self,
        column: Any,
        operator: str,
        value: Any,
        value2: Any,
    ) -> list[Any]:
        column_text = self._text_column_expression(column)

        if operator in {"is-empty", "empty"}:
            return [self._is_text_empty(column)]
        if operator in {"not-empty", "is-not-empty"}:
            return [not_(self._is_text_empty(column))]
        if operator in {"is-null", "null"}:
            return [column.is_(None)]
        if operator in {"not-null", "is-not-null"}:
            return [column.is_not(None)]
        if operator in {"in", "not-in", "notin"}:
            values = [self._normalize_text_value(item) for item in self._to_sequence(value)]
            values = [item for item in values if item is not None]
            if not values:
                return []
            condition = self._build_text_in_condition(column, values)
            return [condition if operator == "in" else not_(condition)]
        normalized = self._normalize_text_value(value)
        if operator in {"eq", "equals", "is"}:
            if normalized is None:
                return []
            return [self._build_text_equals_condition(column, normalized)]
        if operator in {"ne", "not-equals", "notequals", "is-not"}:
            if normalized is None:
                return []
            return [self._build_text_not_equals_condition(column, normalized)]
        if operator == "contains":
            normalized2 = self._normalize_text_value(value2)
            if normalized is None:
                return []
            return [column_text.contains(normalized.lower())]
        if operator in {"startswith", "starts-with"}:
            if normalized is None:
                return []
            return [column_text.startswith(normalized.lower())]
        if operator in {"endswith", "ends-with"}:
            if normalized is None:
                return []
            return [column_text.endswith(normalized.lower())]
        if operator in {"gt", ">"}:
            if normalized is None:
                return []
            return [column_text > str(normalized).lower()]
        if operator in {"gte", ">="}:
            if normalized is None:
                return []
            return [column_text >= str(normalized).lower()]
        if operator in {"lt", "<"}:
            if normalized is None:
                return []
            return [column_text < str(normalized).lower()]
        if operator in {"lte", "<="}:
            if normalized is None:
                return []
            return [column_text <= str(normalized).lower()]
        if operator in {"regex", "matches"}:
            if normalized is None:
                return []
            return [column_text.op("~*")(str(normalized))]
        return []

    def _build_numeric_predicate_conditions(
        self,
        column: Any,
        operator: str,
        value: Any,
        value2: Any,
    ) -> list[Any]:
        if operator in {"is-empty", "empty"}:
            return [column.is_(None)]
        if operator in {"not-empty", "is-not-empty"}:
            return [column.is_not(None)]
        if operator in {"is-null", "null"}:
            return [column.is_(None)]
        if operator in {"not-null", "is-not-null"}:
            return [column.is_not(None)]

        if operator in {"in", "not-in", "notin"}:
            values = [coerced for coerced in (self._coerce_optional_number(item) for item in self._to_sequence(value)) if coerced is not None]
            if not values:
                return []
            condition = column.in_(values)
            return [condition if operator == "in" else not_(condition)]

        left = self._coerce_optional_number(value)
        right = self._coerce_optional_number(value2)
        if operator in {"between", "range"}:
            if left is None or right is None:
                return []
            minimum = min(left, right)
            maximum = max(left, right)
            return [and_(column >= minimum, column <= maximum)]
        if left is None:
            return []
        if operator in {"eq", "equals", "is"}:
            return [column == left]
        if operator in {"ne", "not-equals", "notequals", "is-not"}:
            return [column != left]
        if operator in {"gt", ">"}:
            return [column > left]
        if operator in {"gte", ">="}:
            return [column >= left]
        if operator in {"lt", "<"}:
            return [column < left]
        if operator in {"lte", "<="}:
            return [column <= left]
        return []

    def _build_datetime_predicate_conditions(
        self,
        column: Any,
        operator: str,
        value: Any,
        value2: Any,
    ) -> list[Any]:
        if operator in {"is-empty", "empty"}:
            return [column.is_(None)]
        if operator in {"not-empty", "is-not-empty"}:
            return [column.is_not(None)]
        if operator in {"is-null", "null"}:
            return [column.is_(None)]
        if operator in {"not-null", "is-not-null"}:
            return [column.is_not(None)]

        if operator in {"in", "not-in", "notin"}:
            values = [coerced for coerced in (self._coerce_optional_datetime(item) for item in self._to_sequence(value)) if coerced is not None]
            if not values:
                return []
            condition = column.in_(values)
            return [condition if operator == "in" else not_(condition)]

        left = self._coerce_optional_datetime(value)
        right = self._coerce_optional_datetime(value2)
        if operator in {"between", "range"}:
            if left is None or right is None:
                return []
            minimum = min(left, right)
            maximum = max(left, right)
            return [and_(column >= minimum, column <= maximum)]
        if left is None:
            return []
        if operator in {"eq", "equals", "is"}:
            return [column == left]
        if operator in {"ne", "not-equals", "notequals", "is-not"}:
            return [column != left]
        if operator in {"gt", ">"}:
            return [column > left]
        if operator in {"gte", ">="}:
            return [column >= left]
        if operator in {"lt", "<"}:
            return [column < left]
        if operator in {"lte", "<="}:
            return [column <= left]
        return []

    def _build_advanced_expression_condition(self, expression: Any) -> Any | None:
        if not isinstance(expression, Mapping):
            return None
        kind = str(expression.get("kind") or "").strip().lower()
        if kind == "condition":
            return self._build_advanced_condition(expression)
        if kind == "not":
            child = self._build_advanced_expression_condition(expression.get("child"))
            if child is None:
                return literal(False)
            return not_(child)
        if kind == "group":
            children = [
                child
                for child in (
                    self._build_advanced_expression_condition(item)
                    for item in expression.get("children") or []
                )
                if child is not None
            ]
            if not children:
                return literal(False)
            operator = str(expression.get("operator") or "and").strip().lower()
            if operator == "or":
                return or_(*children)
            return and_(*children)
        return literal(False)

    def _build_advanced_condition(self, condition: Mapping[str, Any]) -> Any:
        column_id = str(condition.get("key") or condition.get("field") or "").strip()
        if not column_id:
            return literal(False)
        definition = self._column_definition(column_id)
        if definition is None or not definition.filterable:
            return literal(False)

        column = getattr(self._model, definition.model_attr)
        operator = str(condition.get("operator") or "equals").strip().lower()
        value = condition.get("value")
        value2 = condition.get("value2")
        condition_type = str(condition.get("type") or definition.value_type).strip().lower()

        if condition_type == "number":
            clauses = self._build_numeric_predicate_conditions(column, operator, value, value2)
        elif condition_type == "date":
            clauses = self._build_datetime_predicate_conditions(column, operator, value, value2)
        else:
            clauses = self._build_text_predicate_conditions(column, operator, value, value2)

        if clauses:
            return clauses[0]
        return literal(False)

    def _resolve_advanced_expression(self, filter_model: dict[str, Any]) -> Any | None:
        advanced_expression = filter_model.get("advancedExpression")
        if advanced_expression is not None:
            return advanced_expression

        advanced_filters = filter_model.get("advancedFilters")
        if not isinstance(advanced_filters, Mapping):
            return None

        per_column_expressions: list[Any] = []
        for key, advanced in advanced_filters.items():
            if not isinstance(advanced, Mapping):
                continue
            clauses = advanced.get("clauses")
            if not isinstance(clauses, Sequence) or isinstance(clauses, (str, bytes)) or len(clauses) == 0:
                continue
            first_clause = clauses[0]
            if not isinstance(first_clause, Mapping):
                continue

            current: Any | None = self._build_legacy_clause_condition(
                str(key),
                str(advanced.get("type") or "text"),
                first_clause,
            )
            for clause in clauses[1:]:
                if not isinstance(clause, Mapping):
                    continue
                next_condition = self._build_legacy_clause_condition(
                    str(key),
                    str(advanced.get("type") or "text"),
                    clause,
                )
                join = self._normalize_clause_join(clause.get("join"))
                if current is None:
                    current = next_condition
                    continue
                current = {
                    "kind": "group",
                    "operator": join,
                    "children": [current, next_condition],
                }

            if current is not None:
                per_column_expressions.append(current)

        if not per_column_expressions:
            return None
        if len(per_column_expressions) == 1:
            return per_column_expressions[0]
        return {
            "kind": "group",
            "operator": "and",
            "children": per_column_expressions,
        }

    def _build_legacy_clause_condition(
        self,
        column_id: str,
        condition_type: str,
        clause: Mapping[str, Any],
    ) -> Any:
        operator = str(clause.get("operator") or "equals").strip().lower()
        return {
            "kind": "condition",
            "key": column_id,
            "type": condition_type,
            "operator": operator,
            "value": clause.get("value"),
            "value2": clause.get("value2"),
        }

    def _normalize_clause_join(self, join: Any) -> str:
        return "or" if str(join or "and").strip().lower() == "or" else "and"

    def _build_text_equals_condition(self, column: Any, value: Any) -> Any:
        return self._text_column_expression(column) == self._normalize_text_value(value)

    def _build_text_not_equals_condition(self, column: Any, value: Any) -> Any:
        return self._text_column_expression(column) != self._normalize_text_value(value)

    def _build_text_in_condition(self, column: Any, values: Sequence[Any]) -> Any:
        normalized_values = [self._normalize_text_value(value) for value in values if self._normalize_text_value(value) is not None]
        return self._text_column_expression(column).in_(normalized_values)

    def _build_text_contains_condition(self, column: Any, value: Any) -> Any:
        normalized = self._normalize_text_value(value)
        if normalized is None:
            return literal(False)
        return self._text_column_expression(column).contains(normalized.lower())

    def _text_column_expression(self, column: Any) -> Any:
        return func.lower(cast(column, String))

    def _is_text_empty(self, column: Any) -> Any:
        return or_(column.is_(None), func.trim(cast(column, String)) == "")

    def _normalize_text_value(self, value: Any) -> str | None:
        normalized = normalize_filter_scalar(value)
        if normalized is None:
            return None
        return str(normalized).strip().lower()

    def _coerce_optional_number(self, value: Any) -> int | float | None:
        normalized = normalize_filter_scalar(value)
        if normalized is None:
            return None
        if isinstance(normalized, (int, float)) and not isinstance(normalized, bool):
            return normalized
        try:
            numeric = float(normalized)
        except (TypeError, ValueError):
            return None
        if numeric.is_integer():
            return int(numeric)
        return numeric

    def _coerce_optional_datetime(self, value: Any) -> datetime | None:
        normalized = normalize_filter_scalar(value)
        if normalized is None:
            return None
        if isinstance(normalized, datetime):
            return normalized
        if isinstance(normalized, str):
            candidate = normalized.strip()
            if not candidate:
                return None
            if candidate.endswith("Z"):
                candidate = f"{candidate[:-1]}+00:00"
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                return None
        return None

    def _to_sequence(self, value: Any) -> Sequence[Any]:
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
            return value
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return [value]

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
