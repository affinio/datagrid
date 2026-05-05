from __future__ import annotations

from collections.abc import Sequence

from app.features.server_demo.schemas import ServerDemoEditInvalidation, ServerDemoInvalidationRange
from app.grid.invalidation import GridInvalidationReasonMap, GridInvalidationService


class ServerDemoInvalidationService(GridInvalidationService):
    def __init__(self):
        super().__init__(GridInvalidationReasonMap())

    def build_range_invalidation(
        self,
        operation_type: str,
        affected_indexes: Sequence[int],
    ) -> ServerDemoEditInvalidation | None:
        invalidation = super().build_range_invalidation(operation_type, affected_indexes)
        if invalidation is None:
            return None
        return ServerDemoEditInvalidation(
            kind=invalidation.kind,
            range=ServerDemoInvalidationRange(start=invalidation.range_start, end=invalidation.range_end),
            reason=invalidation.reason,
        )
