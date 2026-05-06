from affino_grid_backend.core.columns import GridColumnDefinition
from affino_grid_backend.core.values import normalize_edit_int


def test_package_exports_and_core_helpers_work() -> None:
    column = GridColumnDefinition(id="value", model_attr="value", editable=True, value_type="integer")

    assert column.id == "value"
    assert normalize_edit_int("42") == 42
