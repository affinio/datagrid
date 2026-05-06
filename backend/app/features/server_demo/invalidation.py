from __future__ import annotations

from collections.abc import Sequence

from app.features.server_demo.schemas import ServerDemoEditInvalidation, ServerDemoInvalidationRange
from affino_grid_backend.core.invalidation import (
    GridInvalidationReasonMap,
    GridInvalidationService,
    GridRangeInvalidation,
    GridRowsInvalidation,
)


class ServerDemoInvalidationService(GridInvalidationService):
    def __init__(self):
        super().__init__(GridInvalidationReasonMap())

    def build_range_invalidation(
        self,
        operation_type: str,
        affected_indexes: Sequence[int],
    ) -> ServerDemoEditInvalidation | None:
        invalidation = super().build_range_invalidation(operation_type, affected_indexes)
        return self._to_dto(invalidation)

    def build_rows_invalidation(
        self,
        operation_type: str,
        row_ids: Sequence[str],
    ) -> ServerDemoEditInvalidation | None:
        invalidation = super().build_rows_invalidation(operation_type, row_ids)
        return self._to_dto(invalidation)

    def _to_dto(self, invalidation: GridRangeInvalidation | GridRowsInvalidation | None) -> ServerDemoEditInvalidation | None:
        if invalidation is None:
            return None
        if isinstance(invalidation, GridRangeInvalidation):
            return ServerDemoEditInvalidation(
                kind=invalidation.kind,
                range=ServerDemoInvalidationRange(start=invalidation.range_start, end=invalidation.range_end),
                reason=invalidation.reason,
            )
        return ServerDemoEditInvalidation(
            kind=invalidation.kind,
            row_ids=list(invalidation.row_ids),
            reason=invalidation.reason,
        )
