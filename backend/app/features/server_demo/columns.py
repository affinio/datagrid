from __future__ import annotations

from app.grid.columns import GridColumnDefinition, MutableGridColumnRegistry


ServerDemoColumnDefinition = GridColumnDefinition


SERVER_DEMO_COLUMNS: MutableGridColumnRegistry = {
    "id": ServerDemoColumnDefinition(
        id="id",
        model_attr="id",
        readonly=True,
    ),
    "index": ServerDemoColumnDefinition(
        id="index",
        model_attr="row_index",
        sortable=True,
        readonly=True,
    ),
    "name": ServerDemoColumnDefinition(
        id="name",
        model_attr="name",
        editable=True,
        sortable=True,
        filterable=True,
        value_type="string",
    ),
    "segment": ServerDemoColumnDefinition(
        id="segment",
        model_attr="segment",
        editable=True,
        sortable=True,
        filterable=True,
        histogram=True,
        value_type="enum",
        enum_values=frozenset({"Core", "Growth", "Enterprise", "SMB"}),
    ),
    "status": ServerDemoColumnDefinition(
        id="status",
        model_attr="status",
        editable=True,
        sortable=True,
        filterable=True,
        histogram=True,
        value_type="enum",
        enum_values=frozenset({"Active", "Paused", "Closed"}),
    ),
    "region": ServerDemoColumnDefinition(
        id="region",
        model_attr="region",
        editable=True,
        sortable=True,
        filterable=True,
        histogram=True,
        value_type="enum",
        enum_values=frozenset({"AMER", "EMEA", "APAC", "LATAM"}),
    ),
    "value": ServerDemoColumnDefinition(
        id="value",
        model_attr="value",
        editable=True,
        sortable=True,
        filterable=True,
        histogram=True,
        value_type="integer",
    ),
    "updatedAt": ServerDemoColumnDefinition(
        id="updatedAt",
        model_attr="updated_at",
        sortable=True,
        readonly=True,
        value_type="datetime",
    ),
    "updated_at": ServerDemoColumnDefinition(
        id="updated_at",
        model_attr="updated_at",
        sortable=True,
        readonly=True,
        value_type="datetime",
    ),
}
