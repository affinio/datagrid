from __future__ import annotations

from typing import Any

from app.grid.table import GridTableDefinition


def workspace_column_condition(column: Any, workspace_id: str | None) -> Any:
    if workspace_id is None:
        return column.is_(None)
    return column == workspace_id


def workspace_scope_condition(table: GridTableDefinition, workspace_id: str | None) -> Any | None:
    if table.workspace_id_attr is None:
        return None

    column = getattr(table.model, table.workspace_id_attr)
    return workspace_column_condition(column, workspace_id)
