from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.grid.columns import GridColumnDefinition, GridColumnRegistry


@dataclass(frozen=True)
class GridTableDefinition:
    table_id: str
    model: type[Any]
    row_id_attr: str
    row_index_attr: str
    updated_at_attr: str
    columns: GridColumnRegistry
    default_sort_column_id: str = "index"

    def column(self, column_id: str) -> GridColumnDefinition | None:
        return self.columns.get(column_id)

    def model_attr(self, column_id: str) -> str:
        definition = self.column(column_id)
        if definition is None:
            raise KeyError(column_id)
        return definition.model_attr

    def row_id_value(self, row: Any) -> str:
        return getattr(row, self.row_id_attr)

    def row_index_value(self, row: Any) -> int:
        return getattr(row, self.row_index_attr)

    def updated_at_value(self, row: Any) -> Any:
        return getattr(row, self.updated_at_attr)
