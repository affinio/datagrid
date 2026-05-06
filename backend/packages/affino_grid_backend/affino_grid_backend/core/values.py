from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from affino_grid_backend.core.columns import GridColumnDefinition
from affino_grid_backend.core.errors import ApiException

INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")


def normalize_filter_scalar(value: Any) -> Any | None:
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


def coerce_optional_int(value: Any) -> int | None:
    normalized = normalize_filter_scalar(value)
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


def normalize_edit_value(column: GridColumnDefinition, value: Any) -> Any:
    if column.value_type == "string":
        if value is None:
            return None
        return str(value)

    if column.value_type == "enum":
        enum_values = column.enum_values or frozenset()
        if value == "":
            return ""
        if not isinstance(value, str):
            raise ApiException(
                status_code=400,
                code="invalid-enum-value",
                message=f"{column.id} must be one of {sorted(enum_values)}",
            )
        normalized = value.strip()
        if normalized not in enum_values:
            raise ApiException(
                status_code=400,
                code="invalid-enum-value",
                message=f"{column.id} must be one of {sorted(enum_values)}",
            )
        return normalized

    if column.value_type == "integer":
        if value is None or value == "":
            return None
        return normalize_edit_int(value)

    if column.value_type == "datetime":
        return value

    raise ApiException(
        status_code=400,
        code="unsupported-column",
        message=f"{column.id} is not editable",
    )


def normalize_edit_int(value: Any) -> int:
    if isinstance(value, bool):
        raise ApiException(
            status_code=400,
            code="invalid-integer-value",
            message="value edits must contain an integer",
        )
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        normalized = value.strip()
        if normalized and INTEGER_PATTERN.match(normalized):
            return int(normalized)
    raise ApiException(
        status_code=400,
        code="invalid-integer-value",
        message="value edits must contain an integer",
    )


def json_edit_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def reject_reason_for_column(column: GridColumnDefinition | None, row_exists: bool) -> str | None:
    if column is None:
        return "unsupported-column"
    if column.readonly:
        return "readonly-column"
    if not column.editable:
        return "unsupported-column"
    if not row_exists:
        return "row-not-found"
    return None
