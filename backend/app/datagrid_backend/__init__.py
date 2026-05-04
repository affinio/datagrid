"""Reusable backend companion layer for Affino DataGrid."""

from .column_registry import (
    ColumnRegistryError,
    DataGridColumnDefinition,
    DataGridColumnRegistry,
    UnknownDataGridColumnError,
    UnsupportedDataGridColumnOperationError,
)
from .dto import (
    DataGridColumnHistogramEntry,
    DataGridColumnHistogramRequest,
    DataGridCommitEdit,
    DataGridCommitEditsRequest,
    DataGridCommitEditsResponse,
    DataGridCommitResult,
    DataGridFillOperationRequest,
    DataGridFillOperationResponse,
    DataGridInvalidation,
    DataGridPullRowsRequest,
    DataGridPullRowsResponse,
    DataGridRowEntry,
    DataGridUndoFillOperationRequest,
    DataGridUndoFillOperationResponse,
    SortDescriptor,
    ViewportRange,
)

__all__ = [
    "ColumnRegistryError",
    "DataGridColumnDefinition",
    "DataGridColumnHistogramEntry",
    "DataGridColumnHistogramRequest",
    "DataGridColumnRegistry",
    "DataGridCommitEdit",
    "DataGridCommitEditsRequest",
    "DataGridCommitEditsResponse",
    "DataGridCommitResult",
    "DataGridFillOperationRequest",
    "DataGridFillOperationResponse",
    "DataGridInvalidation",
    "DataGridPullRowsRequest",
    "DataGridPullRowsResponse",
    "DataGridRowEntry",
    "DataGridUndoFillOperationRequest",
    "DataGridUndoFillOperationResponse",
    "SortDescriptor",
    "UnknownDataGridColumnError",
    "UnsupportedDataGridColumnOperationError",
    "ViewportRange",
]

