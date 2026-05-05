from __future__ import annotations

from collections.abc import Sequence

from app.features.server_demo.schemas import ServerDemoEditInvalidation
from app.features.server_demo.schemas import ServerDemoInvalidationRange


class ServerDemoInvalidationService:
    def build_range_invalidation(
        self,
        operation_type: str,
        affected_indexes: Sequence[int],
    ) -> ServerDemoEditInvalidation | None:
        if not affected_indexes:
            return None
        return ServerDemoEditInvalidation(
            kind="range",
            range=ServerDemoInvalidationRange(
                start=min(affected_indexes),
                end=max(affected_indexes),
            ),
            reason=self._operation_invalidation_reason(operation_type),
        )

    def _operation_invalidation_reason(self, operation_type: str) -> str:
        if operation_type == "fill":
            return "server-demo-fill"
        return "server-demo-edits"

