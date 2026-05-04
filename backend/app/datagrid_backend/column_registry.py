"""Column metadata and safe lookup helpers for DataGrid backend integrations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Generic, Iterable, TypeVar


TValue = TypeVar("TValue")


class ColumnRegistryError(ValueError):
    """Base error for registry lookup and capability validation failures."""


class UnknownDataGridColumnError(ColumnRegistryError):
    """Raised when the frontend references a column key that is not registered."""


class UnsupportedDataGridColumnOperationError(ColumnRegistryError):
    """Raised when an operation is not allowed for the resolved column."""


ValueCaster = Callable[[Any], Any]
ValueValidator = Callable[[Any], None]


@dataclass(slots=True, frozen=True)
class DataGridColumnDefinition(Generic[TValue]):
    """Metadata for a single registered DataGrid column."""

    key: str
    label: str
    sortable: bool = False
    filterable: bool = False
    editable: bool = False
    aggregatable: bool = False
    value_caster: ValueCaster | None = None
    validator: ValueValidator | None = None

    def cast_value(self, value: Any) -> Any:
        """Cast an incoming value using the configured caster, if present."""

        if self.value_caster is None:
            return value
        return self.value_caster(value)

    def validate_value(self, value: Any) -> None:
        """Validate an incoming value using the configured validator, if present."""

        if self.validator is not None:
            self.validator(value)


class DataGridColumnRegistry:
    """Registry that resolves frontend column keys to backend column metadata."""

    def __init__(self, columns: Iterable[DataGridColumnDefinition[Any]] | None = None) -> None:
        self._columns: dict[str, DataGridColumnDefinition[Any]] = {}
        if columns is not None:
            for column in columns:
                self.register(column)

    def register(self, column: DataGridColumnDefinition[Any]) -> None:
        """Register or replace a column definition."""

        normalized_key = self._normalize_key(column.key)
        if not normalized_key:
            raise ValueError("column key must be a non-empty string")
        self._columns[normalized_key] = column

    def get(self, column_key: str) -> DataGridColumnDefinition[Any] | None:
        """Return a column definition if it exists."""

        return self._columns.get(self._normalize_key(column_key))

    def require(self, column_key: str) -> DataGridColumnDefinition[Any]:
        """Return a column definition or raise an unknown-column error."""

        column = self.get(column_key)
        if column is None:
            raise UnknownDataGridColumnError(f"unknown DataGrid column: {column_key}")
        return column

    def ensure_allowed(self, column_key: str, operation: str) -> DataGridColumnDefinition[Any]:
        """Return a column definition if the requested operation is permitted."""

        column = self.require(column_key)
        if operation == "sort" and not column.sortable:
            raise UnsupportedDataGridColumnOperationError(f"column '{column_key}' is not sortable")
        if operation == "filter" and not column.filterable:
            raise UnsupportedDataGridColumnOperationError(f"column '{column_key}' is not filterable")
        if operation == "edit" and not column.editable:
            raise UnsupportedDataGridColumnOperationError(f"column '{column_key}' is not editable")
        if operation == "aggregate" and not column.aggregatable:
            raise UnsupportedDataGridColumnOperationError(f"column '{column_key}' is not aggregatable")
        return column

    def cast_value(self, column_key: str, value: Any) -> Any:
        """Cast and validate a value for a registered column."""

        column = self.require(column_key)
        casted = column.cast_value(value)
        column.validate_value(casted)
        return casted

    @staticmethod
    def _normalize_key(column_key: str) -> str:
        if not isinstance(column_key, str):
            return ""
        return column_key.strip()
