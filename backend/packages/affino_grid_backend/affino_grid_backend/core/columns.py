from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping


@dataclass(frozen=True)
class GridColumnDefinition:
    id: str
    model_attr: str
    editable: bool = False
    sortable: bool = False
    filterable: bool = False
    histogram: bool = False
    value_type: Literal["string", "integer", "enum", "datetime"] = "string"
    enum_values: frozenset[str] | None = None
    readonly: bool = False


GridColumnRegistry = Mapping[str, GridColumnDefinition]
MutableGridColumnRegistry = dict[str, GridColumnDefinition]
