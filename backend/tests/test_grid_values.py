from __future__ import annotations

import pytest

from app.api.errors import ApiException
from app.grid.columns import GridColumnDefinition
from app.grid.values import (
    coerce_optional_int,
    normalize_edit_int,
    normalize_edit_value,
    normalize_filter_scalar,
    reject_reason_for_column,
)


def test_normalize_filter_scalar_tokens() -> None:
    assert normalize_filter_scalar(None) is None
    assert normalize_filter_scalar("") is None
    assert normalize_filter_scalar(" string:abc ") == "abc"
    assert normalize_filter_scalar("number:42") == "42"
    assert normalize_filter_scalar("date:2025-01-01") == "2025-01-01"
    assert normalize_filter_scalar("null") is None
    assert normalize_filter_scalar("boolean:true") is True
    assert normalize_filter_scalar("boolean:false") is False


def test_coerce_optional_int_invalid_numeric_filter_raises() -> None:
    with pytest.raises(ApiException) as exc_info:
        coerce_optional_int("abc")

    assert exc_info.value.code == "invalid_filter"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (1, 1),
        (1.0, 1),
        (" 2 ", 2),
        ("+3", 3),
        ("-4", -4),
    ],
)
def test_normalize_edit_int_accepts_valid_values(value: object, expected: int) -> None:
    assert normalize_edit_int(value) == expected


@pytest.mark.parametrize("value", [True, False, "", "abc", 1.5, object()])
def test_normalize_edit_int_rejects_invalid_values(value: object) -> None:
    with pytest.raises(ApiException) as exc_info:
        normalize_edit_int(value)

    assert exc_info.value.code == "invalid-integer-value"


def test_normalize_edit_value_for_enum_and_string() -> None:
    enum_column = GridColumnDefinition(
        id="segment",
        model_attr="segment",
        editable=True,
        value_type="enum",
        enum_values=frozenset({"Core", "SMB"}),
    )
    string_column = GridColumnDefinition(id="name", model_attr="name", editable=True)

    assert normalize_edit_value(enum_column, "") == ""
    assert normalize_edit_value(enum_column, " Core ") == "Core"
    assert normalize_edit_value(string_column, "hello") == "hello"

    with pytest.raises(ApiException) as exc_info:
        normalize_edit_value(enum_column, "Other")

    assert exc_info.value.code == "invalid-enum-value"


def test_reject_reason_for_column_cases() -> None:
    editable = GridColumnDefinition(id="name", model_attr="name", editable=True)
    readonly = GridColumnDefinition(id="id", model_attr="id", readonly=True)
    unsupported = GridColumnDefinition(id="value", model_attr="value")

    assert reject_reason_for_column(None, True) == "unsupported-column"
    assert reject_reason_for_column(readonly, True) == "readonly-column"
    assert reject_reason_for_column(unsupported, True) == "unsupported-column"
    assert reject_reason_for_column(editable, False) == "row-not-found"
