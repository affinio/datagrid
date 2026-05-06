from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from affino_grid_backend.core.errors import ApiException
from affino_grid_backend.core.mutations import GridFillMutationResult, PendingGridCellEvent
from affino_grid_backend.core.revision import GridRevisionService
from affino_grid_backend.core.table import GridTableDefinition
from affino_grid_backend.core.values import coerce_optional_int, json_edit_value, normalize_edit_value, reject_reason_for_column

logger = logging.getLogger(__name__)


class GridFillServiceBase(ABC):
    operation_type = "fill"

    def __init__(
        self,
        table: GridTableDefinition,
        revision_service: GridRevisionService,
        *,
        max_fill_target_rows: int = 1000,
        max_boundary_scan_limit: int = 1000,
        max_fill_source_rows: int = 100,
        max_fill_columns: int = 50,
        max_fill_cells: int = 5000,
    ):
        self._table = table
        self._revision_service = revision_service
        self._max_fill_target_rows = max(0, int(max_fill_target_rows))
        self._max_boundary_scan_limit = max(0, int(max_boundary_scan_limit))
        self._max_fill_source_rows = max(0, int(max_fill_source_rows))
        self._max_fill_columns = max(0, int(max_fill_columns))
        self._max_fill_cells = max(0, int(max_fill_cells))

    async def resolve_boundary(self, session: AsyncSession, request: Any) -> dict[str, Any]:
        total = await self.count_projected_rows(session, request.projection)
        start_index = max(0, request.start_row_index)
        requested_limit = self._normalize_fill_scan_limit(request.limit)
        limit = min(requested_limit, self._max_boundary_scan_limit)
        if requested_limit > limit:
            logger.warning(
                "boundary-truncated requested_limit=%s max_limit=%s start_index=%s",
                requested_limit,
                self._max_boundary_scan_limit,
                start_index,
            )

        if total == 0:
            return {
                "end_row_index": None,
                "end_row_id": None,
                "boundary_kind": "data-end",
                "scanned_row_count": 0,
                "truncated": False,
            }

        if start_index >= total:
            last_row = await self.fetch_projected_row(session, request.projection, total - 1)
            return {
                "end_row_index": total - 1,
                "end_row_id": self.get_row_id(last_row) if last_row is not None else None,
                "boundary_kind": "data-end",
                "scanned_row_count": 0,
                "truncated": False,
            }

        scanned = 0
        last_contiguous_index = max(0, start_index - 1)
        boundary_kind: str = "data-end"
        rows = await self.fetch_projected_rows(session, request.projection, start_index, limit)
        for offset, row in enumerate(rows):
            if scanned >= limit:
                boundary_kind = "cache-boundary"
                break
            scanned += 1
            if not self._has_fill_boundary_value(row, request.reference_columns):
                boundary_kind = "gap" if start_index + offset < total - 1 else "data-end"
                break
            last_contiguous_index = start_index + offset
        else:
            if start_index + len(rows) < total and scanned >= limit:
                boundary_kind = "cache-boundary"
            elif start_index + len(rows) >= total:
                boundary_kind = "data-end"

        end_row = await self.fetch_projected_row(session, request.projection, last_contiguous_index)
        if boundary_kind == "cache-boundary":
            logger.warning(
                "boundary-truncated start_index=%s scanned_row_count=%s limit=%s total=%s",
                start_index,
                scanned,
                limit,
                total,
            )
        return {
            "end_row_index": last_contiguous_index,
            "end_row_id": self.get_row_id(end_row) if end_row is not None else None,
            "boundary_kind": boundary_kind,
            "scanned_row_count": scanned,
            "truncated": boundary_kind == "cache-boundary",
        }

    async def commit_fill(self, session: AsyncSession, request: Any) -> GridFillMutationResult:
        mode = self.normalize_fill_mode(request.mode)
        if mode == "series":
            raise ApiException(
                status_code=400,
                code="unsupported-fill-mode",
                message="Series fill is not implemented yet",
            )

        source_row_ids = self.normalize_row_ids(request.source_row_ids)
        target_row_ids = self.normalize_row_ids(request.target_row_ids)
        fill_columns = self.normalize_column_ids(request.fill_columns)
        reference_columns = self.normalize_column_ids(request.reference_columns)
        source_range = self.normalize_fill_range(request.source_range)
        target_range = self.normalize_fill_range(request.target_range)
        target_row_count = len(target_row_ids)

        if not source_row_ids or not target_row_ids:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message="sourceRowIds and targetRowIds must not be empty",
            )
        if not fill_columns:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message="fillColumns must not be empty",
            )
        if not reference_columns:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message="referenceColumns must not be empty",
            )
        if len(source_row_ids) > self._max_fill_source_rows:
            raise ApiException(
                status_code=400,
                code="fill-source-too-large",
                message="Fill source range exceeds maximum allowed size",
            )
        if len(fill_columns) > self._max_fill_columns:
            raise ApiException(
                status_code=400,
                code="too-many-fill-columns",
                message="Fill column count exceeds maximum allowed size",
            )
        if len(reference_columns) > self._max_fill_columns:
            raise ApiException(
                status_code=400,
                code="too-many-reference-columns",
                message="Reference column count exceeds maximum allowed size",
            )
        if target_row_count > self._max_fill_target_rows:
            raise ApiException(
                status_code=400,
                code="fill-range-too-large",
                message="Fill range exceeds maximum allowed size",
            )
        if target_row_count * len(fill_columns) > self._max_fill_cells:
            raise ApiException(
                status_code=400,
                code="fill-cell-count-too-large",
                message="Fill cell count exceeds maximum allowed size",
            )

        requested_operation_id = self.normalize_optional_operation_id(request.operation_id)
        operation_id = requested_operation_id or self.create_fill_operation_id()
        operation_metadata = self.build_fill_operation_metadata(
            source_range=source_range,
            target_range=target_range,
            source_row_ids=source_row_ids,
            target_row_ids=target_row_ids,
            fill_columns=fill_columns,
            reference_columns=reference_columns,
            mode=mode,
            projection=self.serialize_projection(request.projection),
            metadata=request.metadata,
        )

        affected_row_ids: list[str] = []
        affected_indexes: list[int] = []
        affected_cell_count = 0
        warnings: list[str] = []

        async with session.begin():
            await self.ensure_operation_id_available(session, operation_id)
            row_ids = list(dict.fromkeys([*source_row_ids, *target_row_ids]))
            rows_by_id = await self.fetch_rows_by_ids(session, row_ids, with_for_update=True)

            missing_source_rows = [row_id for row_id in source_row_ids if row_id not in rows_by_id]
            missing_target_rows = [row_id for row_id in target_row_ids if row_id not in rows_by_id]
            if missing_source_rows or missing_target_rows:
                missing_ids = ", ".join([*missing_source_rows, *missing_target_rows])
                raise ApiException(
                    status_code=404,
                    code="row-not-found",
                    message=f"Fill rows were not found: {missing_ids}",
                )

            source_rows = [rows_by_id[row_id] for row_id in source_row_ids]
            target_rows = [rows_by_id[row_id] for row_id in target_row_ids]
            source_matrix = [
                [self.get_row_value(row, column_id) for column_id in reference_columns]
                for row in source_rows
            ]
            cell_events: list[PendingGridCellEvent] = []
            changed_rows: dict[str, Any] = {}
            changed_at = datetime.now(timezone.utc)

            for target_row_index, target_row in enumerate(target_rows):
                source_row_offset = target_row_index % len(source_matrix)
                source_row_values = source_matrix[source_row_offset] if source_matrix else []
                for column_offset, column_id in enumerate(fill_columns):
                    reject_reason = reject_reason_for_column(self._table.column(column_id), target_row is not None)
                    if reject_reason is not None:
                        warnings.append(f"{column_id}: {reject_reason}")
                        continue

                    try:
                        source_value = source_row_values[column_offset % len(source_row_values)] if source_row_values else None
                        next_value = self.normalize_fill_value(column_id, source_value)
                    except ApiException as exc:
                        warnings.append(f"{column_id}: {exc.code}")
                        continue

                    current_value = self.get_row_value(target_row, column_id)
                    before_value = json_edit_value(current_value)
                    after_value = json_edit_value(next_value)
                    cell_events.append(
                        PendingGridCellEvent(
                            row=target_row,
                            row_id=self.get_row_id(target_row),
                            column_id=column_id,
                            before_value=before_value,
                            after_value=after_value,
                        )
                    )
                    if next_value != current_value:
                        self.set_row_value(target_row, column_id, next_value)
                        self.set_row_updated_at(target_row, changed_at)
                        changed_rows[self.get_row_id(target_row)] = target_row
                        affected_cell_count += 1

            if changed_rows:
                await session.flush()
                affected_row_ids = list(changed_rows.keys())
                affected_indexes = [self.get_row_index(row) for row in changed_rows.values()]
                await self.create_fill_operation(session, operation_id, operation_metadata, changed_at, request)
                await session.flush()
                await self.create_cell_events(session, operation_id, cell_events, changed_at)
                revision = await self._revision_service.bump_revision(session)
            else:
                operation_id = None
                warnings.append("server fill no-op")
                revision = await self._revision_service.get_revision(session)

        return GridFillMutationResult(
            operation_id=operation_id,
            affected_row_ids=affected_row_ids,
            affected_indexes=affected_indexes,
            affected_cell_count=affected_cell_count,
            warnings=warnings,
            revision=revision,
        )

    def normalize_fill_value(self, column_id: str, value: Any) -> Any:
        definition = self._table.column(column_id)
        if definition is None or not definition.editable:
            raise ApiException(
                status_code=400,
                code="unsupported-column",
                message=f"{column_id} is not editable",
            )
        return normalize_edit_value(definition, value)

    def create_fill_operation_id(self) -> str:
        return f"fill-{uuid4()}"

    def normalize_fill_mode(self, mode: str) -> str:
        normalized = mode.strip().lower()
        if normalized not in {"copy", "series"}:
            raise ApiException(
                status_code=400,
                code="unsupported-fill-mode",
                message=f"Unsupported fill mode: {mode}",
            )
        return normalized

    def normalize_optional_operation_id(self, operation_id: str | None) -> str | None:
        normalized = operation_id.strip() if operation_id else ""
        return normalized if normalized else None

    def normalize_row_ids(self, row_ids: Sequence[str]) -> list[str]:
        normalized = [row_id.strip() for row_id in row_ids if row_id and row_id.strip()]
        return list(dict.fromkeys(normalized))

    def normalize_column_ids(self, column_ids: Sequence[str]) -> list[str]:
        normalized = [column_id.strip() for column_id in column_ids if column_id and column_id.strip()]
        return list(dict.fromkeys(normalized))

    def normalize_fill_range(self, range_value: Any) -> dict[str, int]:
        if hasattr(range_value, "model_dump"):
            candidate = range_value.model_dump(by_alias=True)
        elif isinstance(range_value, dict):
            candidate = range_value
        else:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message="Fill ranges must be objects",
            )

        start_row = self.coerce_required_fill_int(candidate.get("startRow"), "startRow")
        end_row = self.coerce_required_fill_int(candidate.get("endRow"), "endRow")
        start_column = self.coerce_required_fill_int(candidate.get("startColumn"), "startColumn")
        end_column = self.coerce_required_fill_int(candidate.get("endColumn"), "endColumn")
        if end_row < start_row:
            raise ApiException(status_code=400, code="invalid-fill-request", message="endRow must be >= startRow")
        if end_column < start_column:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message="endColumn must be >= startColumn",
            )
        return {
            "startRow": start_row,
            "endRow": end_row,
            "startColumn": start_column,
            "endColumn": end_column,
        }

    def build_fill_operation_metadata(
        self,
        *,
        source_range: dict[str, int],
        target_range: dict[str, int],
        source_row_ids: Sequence[str],
        target_row_ids: Sequence[str],
        fill_columns: Sequence[str],
        reference_columns: Sequence[str],
        mode: str,
        projection: dict[str, Any],
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return {
            "sourceRange": source_range,
            "targetRange": target_range,
            "sourceRowIds": list(source_row_ids),
            "targetRowIds": list(target_row_ids),
            "fillColumns": list(fill_columns),
            "referenceColumns": list(reference_columns),
            "mode": mode,
            "projection": projection,
            "metadata": metadata or {},
        }

    def coerce_required_fill_int(self, value: Any, field_name: str) -> int:
        coerced = coerce_optional_int(value)
        if coerced is None:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message=f"{field_name} must be an integer",
            )
        return coerced

    def _normalize_fill_scan_limit(self, limit: int | None) -> int:
        if limit is None:
            return 500
        return max(0, int(limit))

    def serialize_projection(self, projection: Any) -> dict[str, Any]:
        if hasattr(projection, "model_dump"):
            return projection.model_dump(by_alias=True)
        if isinstance(projection, dict):
            return projection
        raise ApiException(
            status_code=400,
            code="invalid-fill-request",
            message="projection must be an object",
        )

    def _has_fill_boundary_value(self, row: Any, reference_columns: Sequence[str]) -> bool:
        for column_id in reference_columns:
            if self._is_non_empty_fill_boundary_value(self.get_row_value(row, column_id)):
                return True
        return False

    def _is_non_empty_fill_boundary_value(self, value: Any) -> bool:
        return value is not None and value != ""

    @abstractmethod
    def build_projected_query(self, session: AsyncSession, projection: Any) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def count_projected_rows(self, session: AsyncSession, projection: Any) -> int:
        raise NotImplementedError

    @abstractmethod
    async def fetch_projected_rows(
        self,
        session: AsyncSession,
        projection: Any,
        start_index: int,
        limit: int,
    ) -> Sequence[Any]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_projected_row(self, session: AsyncSession, projection: Any, row_index: int) -> Any | None:
        raise NotImplementedError

    @abstractmethod
    async def fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def ensure_operation_id_available(self, session: AsyncSession, operation_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def create_fill_operation(
        self,
        session: AsyncSession,
        operation_id: str,
        metadata: dict[str, Any],
        changed_at: datetime,
        request: Any,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def create_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        pending_events: Sequence[PendingGridCellEvent],
        changed_at: datetime,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_row_value(self, row: Any, column_id: str) -> Any:
        raise NotImplementedError

    @abstractmethod
    def set_row_value(self, row: Any, column_id: str, value: Any) -> None:
        raise NotImplementedError

    @abstractmethod
    def set_row_updated_at(self, row: Any, changed_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_row_id(self, row: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_row_index(self, row: Any) -> int:
        raise NotImplementedError
