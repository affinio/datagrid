from __future__ import annotations

from app.features.server_demo.columns import SERVER_DEMO_COLUMNS
from app.features.server_demo.models import GridDemoRow
from app.features.server_demo.table import SERVER_DEMO_TABLE


def test_server_demo_table_metadata() -> None:
    assert SERVER_DEMO_TABLE.table_id == "server_demo"
    assert SERVER_DEMO_TABLE.model is GridDemoRow
    assert SERVER_DEMO_TABLE.row_id_attr == "id"
    assert SERVER_DEMO_TABLE.workspace_id_attr == "workspace_id"
    assert SERVER_DEMO_TABLE.row_index_attr == "row_index"
    assert SERVER_DEMO_TABLE.updated_at_attr == "updated_at"
    assert SERVER_DEMO_TABLE.columns is SERVER_DEMO_COLUMNS
    assert {"id", "index", "name", "segment", "status", "region", "value", "updatedAt", "updated_at"} <= set(
        SERVER_DEMO_TABLE.columns
    )
