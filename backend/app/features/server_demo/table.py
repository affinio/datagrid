from __future__ import annotations

from app.features.server_demo.columns import SERVER_DEMO_COLUMNS
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.grid.table import GridTableDefinition

SERVER_DEMO_TABLE = GridTableDefinition(
    table_id="server_demo",
    model=GridDemoRowModel,
    row_id_attr="id",
    workspace_id_attr="workspace_id",
    row_index_attr="row_index",
    updated_at_attr="updated_at",
    columns=SERVER_DEMO_COLUMNS,
    default_sort_column_id="index",
)
