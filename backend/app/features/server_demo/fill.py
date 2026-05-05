from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.columns import ServerDemoColumnDefinition
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.projection import ServerDemoProjectionService
from app.features.server_demo.schemas import ServerDemoFillBoundaryRequest, ServerDemoFillBoundaryResponse
from app.features.server_demo.schemas import ServerDemoFillCommitRequest


@dataclass(frozen=True)
class PendingFillCellEvent:
    row: GridDemoRowModel
    column_id: str
    before_value: Any
    after_value: Any


@dataclass(frozen=True)
class ServerDemoFillCommitResult:
    operation_id: str | None
    affected_row_ids: list[str]
    affected_indexes: list[int]
    affected_cell_count: int
    warnings: list[str]


class ServerDemoFillService:
    def __init__(self, columns: Mapping[str, ServerDemoColumnDefinition], projection: ServerDemoProjectionService):
        self._columns = columns
        self._projection = projection

    async def resolve_boundary(
        self,
        session: AsyncSession,
        request: ServerDemoFillBoundaryRequest,
    ) -> ServerDemoFillBoundaryResponse:
        conditions = self._projection.build_filter_conditions(request.projection.filter_model)
        stmt = self._projection.build_row_query(conditions)
        stmt = stmt.order_by(*self._projection.build_order_by(request.projection.sort_model))

        total = await self._projection.count_rows(session, conditions)
        start_index = max(0, request.start_row_index)
        limit = self._normalize_fill_scan_limit(request.limit)

        if total == 0:
            return ServerDemoFillBoundaryResponse(
                end_row_index=None,
                end_row_id=None,
                boundary_kind="data-end",
                scanned_row_count=0,
                truncated=False,
            )

        if start_index >= total:
            last_row = await self._fetch_projected_row(session, stmt, total - 1)
            return ServerDemoFillBoundaryResponse(
                end_row_index=total - 1,
                end_row_id=last_row.id if last_row is not None else None,
                boundary_kind="data-end",
                scanned_row_count=0,
                truncated=False,
            )

        scanned = 0
        last_contiguous_index = max(0, start_index - 1)
        boundary_kind: str = "data-end"
        rows = await self._fetch_projected_rows(session, stmt, start_index, limit)
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

        end_row = await self._fetch_projected_row(session, stmt, last_contiguous_index)
        return ServerDemoFillBoundaryResponse(
            end_row_index=last_contiguous_index,
            end_row_id=end_row.id if end_row is not None else None,
            boundary_kind=boundary_kind,
            scanned_row_count=scanned,
            truncated=boundary_kind == "cache-boundary",
        )

    async def commit_fill(self, session: AsyncSession, request: ServerDemoFillCommitRequest) -> ServerDemoFillCommitResult:
        mode = self._normalize_fill_mode(request.mode)
        if mode == "series":
            raise ApiException(
                status_code=400,
                code="unsupported-fill-mode",
                message="Series fill is not implemented yet",
            )

        source_row_ids = self._normalize_row_ids(request.source_row_ids)
        target_row_ids = self._normalize_row_ids(request.target_row_ids)
        fill_columns = self._normalize_column_ids(request.fill_columns)
        reference_columns = self._normalize_column_ids(request.reference_columns)
        source_range = self._normalize_fill_range(request.source_range)
        target_range = self._normalize_fill_range(request.target_range)

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

        requested_operation_id = self._normalize_optional_operation_id(request.operation_id)
        operation_id = requested_operation_id or self._create_fill_operation_id()
        operation_metadata = self._build_fill_operation_metadata(
            source_range=source_range,
            target_range=target_range,
            source_row_ids=source_row_ids,
            target_row_ids=target_row_ids,
            fill_columns=fill_columns,
            reference_columns=reference_columns,
            mode=mode,
            projection=request.projection.model_dump(by_alias=True),
            metadata=request.metadata,
        )

        affected_row_ids: list[str] = []
        affected_indexes: list[int] = []
        affected_cell_count = 0
        warnings: list[str] = []

        async with session.begin():
            await self._ensure_operation_id_available(session, operation_id)
            row_ids = list(dict.fromkeys([*source_row_ids, *target_row_ids]))
            rows_by_id = await self._fetch_rows_by_ids(session, row_ids, with_for_update=True)

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
                [self._current_edit_value(row, column_id) for column_id in reference_columns]
                for row in source_rows
            ]
            cell_events: list[PendingFillCellEvent] = []
            changed_rows: dict[str, GridDemoRowModel] = {}
            changed_at = datetime.now(timezone.utc)

            for target_row_index, target_row in enumerate(target_rows):
                source_row_offset = target_row_index % len(source_matrix)
                source_row_values = source_matrix[source_row_offset] if source_matrix else []
                for column_offset, column_id in enumerate(fill_columns):
                    reject_reason = self._reject_reason_for_edit(target_row, column_id)
                    if reject_reason is not None:
                        warnings.append(f"{column_id}: {reject_reason}")
                        continue

                    try:
                        source_value = source_row_values[column_offset % len(source_row_values)] if source_row_values else None
                        next_value = self._normalize_edit_value(column_id, source_value)
                    except ApiException as exc:
                        warnings.append(f"{column_id}: {exc.code}")
                        continue

                    current_value = self._current_edit_value(target_row, column_id)
                    before_value = self._json_edit_value(current_value)
                    after_value = self._json_edit_value(next_value)
                    if next_value != current_value:
                        setattr(target_row, self._model_attribute_for_edit_column(column_id), next_value)
                        target_row.updated_at = changed_at
                        changed_rows[target_row.id] = target_row
                        affected_cell_count += 1
                        cell_events.append(
                            PendingFillCellEvent(
                                row=target_row,
                                column_id=column_id,
                                before_value=before_value,
                                after_value=after_value,
                            )
                        )
                    else:
                        cell_events.append(
                            PendingFillCellEvent(
                                row=target_row,
                                column_id=column_id,
                                before_value=before_value,
                                after_value=after_value,
                            )
                        )

            if changed_rows:
                await session.flush()
                affected_row_ids = list(changed_rows.keys())
                affected_indexes = [row.row_index for row in changed_rows.values()]
                session.add(
                    ServerDemoOperationModel(
                        operation_id=operation_id,
                        operation_type="fill",
                        status="applied",
                        operation_metadata=operation_metadata,
                        revision=changed_at,
                        created_at=changed_at,
                        modified_at=changed_at,
                    )
                )
                await session.flush()
                session.add_all(
                    [
                        ServerDemoCellEventModel(
                            event_id=uuid4(),
                            operation_id=operation_id,
                            row_id=cell_event.row.id,
                            column_key=cell_event.column_id,
                            before_value=cell_event.before_value,
                            after_value=cell_event.after_value,
                            created_at=changed_at,
                        )
                        for cell_event in cell_events
                        if cell_event.before_value != cell_event.after_value
                    ]
                )
            else:
                operation_id = None
                warnings.append("server fill no-op")

        return ServerDemoFillCommitResult(
            operation_id=operation_id,
            affected_row_ids=affected_row_ids,
            affected_indexes=affected_indexes,
            affected_cell_count=affected_cell_count,
            warnings=warnings,
        )

    def _normalize_fill_scan_limit(self, limit: int | None) -> int:
        if limit is None:
            return 500
        return max(0, int(limit))

    def _normalize_fill_mode(self, mode: str) -> str:
        normalized = mode.strip().lower()
        if normalized not in {"copy", "series"}:
            raise ApiException(
                status_code=400,
                code="unsupported-fill-mode",
                message=f"Unsupported fill mode: {mode}",
            )
        return normalized

    def _normalize_row_ids(self, row_ids: Sequence[str]) -> list[str]:
        normalized = [row_id.strip() for row_id in row_ids if row_id and row_id.strip()]
        return list(dict.fromkeys(normalized))

    def _normalize_column_ids(self, column_ids: Sequence[str]) -> list[str]:
        normalized = [column_id.strip() for column_id in column_ids if column_id and column_id.strip()]
        return list(dict.fromkeys(normalized))

    def _normalize_fill_range(self, range_value: Any) -> dict[str, int]:
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

        start_row = self._coerce_required_fill_int(candidate.get("startRow"), "startRow")
        end_row = self._coerce_required_fill_int(candidate.get("endRow"), "endRow")
        start_column = self._coerce_required_fill_int(candidate.get("startColumn"), "startColumn")
        end_column = self._coerce_required_fill_int(candidate.get("endColumn"), "endColumn")
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

    def _coerce_required_fill_int(self, value: Any, field_name: str) -> int:
        coerced = self._coerce_optional_int(value)
        if coerced is None:
            raise ApiException(
                status_code=400,
                code="invalid-fill-request",
                message=f"{field_name} must be an integer",
            )
        return coerced

    def _normalize_optional_operation_id(self, operation_id: str | None) -> str | None:
        normalized = operation_id.strip() if operation_id else ""
        return normalized if normalized else None

    async def _ensure_operation_id_available(self, session: AsyncSession, operation_id: str) -> None:
        existing_count = await session.scalar(
            select(func.count())
            .select_from(ServerDemoOperationModel)
            .where(ServerDemoOperationModel.operation_id == operation_id)
        )
        if existing_count:
            raise ApiException(
                status_code=409,
                code="duplicate-operation-id",
                message=f"Operation {operation_id} already exists",
            )

    def _normalize_filter_scalar(self, value: Any) -> Any | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return None
            if normalized.startswith("string:"):
                normalized = normalized[len("string:") :]
            elif normalized.startswith("number:"):
                normalized = normalized[len("number:") :]
            elif normalized == "null":
                return None
            elif normalized == "boolean:true":
                return True
            elif normalized == "boolean:false":
                return False
            elif normalized.startswith("date:"):
                normalized = normalized[len("date:") :]
            return normalized if normalized else None
        return value

    def _coerce_optional_int(self, value: Any) -> int | None:
        normalized = self._normalize_filter_scalar(value)
        if normalized is None:
            return None
        try:
            return int(normalized)
        except (TypeError, ValueError) as exc:
            raise ApiException(
                status_code=400,
                code="invalid_filter",
                message="Numeric filters must contain integer values",
            ) from exc

    def _build_fill_operation_metadata(
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

    async def _fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
    ) -> dict[str, GridDemoRowModel]:
        if not row_ids:
            return {}
        stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(list(row_ids)))
        if with_for_update:
            stmt = stmt.with_for_update()
        rows = (await session.scalars(stmt)).all()
        return {row.id: row for row in rows}

    async def _fetch_projected_rows(
        self,
        session: AsyncSession,
        projected_stmt: Any,
        start_index: int,
        limit: int,
    ) -> list[GridDemoRowModel]:
        stmt = projected_stmt.offset(start_index).limit(limit)
        return (await session.scalars(stmt)).all()

    async def _fetch_projected_row(
        self,
        session: AsyncSession,
        projected_stmt: Any,
        row_index: int,
    ) -> GridDemoRowModel | None:
        if row_index < 0:
            return None
        stmt = projected_stmt.offset(row_index).limit(1)
        rows = (await session.scalars(stmt)).all()
        return rows[0] if rows else None

    def _has_fill_boundary_value(self, row: GridDemoRowModel, reference_columns: Sequence[str]) -> bool:
        for column_id in reference_columns:
            if self._is_non_empty_fill_boundary_value(self._current_edit_value(row, column_id)):
                return True
        return False

    def _is_non_empty_fill_boundary_value(self, value: Any) -> bool:
        return value is not None and value != ""

    def _reject_reason_for_edit(self, row: GridDemoRowModel | None, column_id: str) -> str | None:
        definition = self._column_definition(column_id)
        if definition is None:
            return "unsupported-column"
        if definition.readonly:
            return "readonly-column"
        if not definition.editable:
            return "unsupported-column"
        if row is None:
            return "row-not-found"
        return None

    def _json_edit_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _normalize_edit_value(self, column_id: str, value: Any) -> Any:
        definition = self._column_definition(column_id)
        if definition is None or not definition.editable:
            raise ApiException(
                status_code=400,
                code="unsupported-column",
                message=f"{column_id} is not editable",
            )

        if definition.value_type == "string":
            if column_id == "name":
                if value is None:
                    raise ApiException(
                        status_code=400,
                        code="invalid-value",
                        message="name edits must contain a string value",
                    )
                return str(value)
            if value is None:
                return None
            return str(value)

        if definition.value_type == "enum":
            enum_values = definition.enum_values or frozenset()
            if value == "":
                return ""
            if not isinstance(value, str):
                raise ApiException(
                    status_code=400,
                    code="invalid-enum-value",
                    message=f"{column_id} must be one of {sorted(enum_values)}",
                )
            normalized = value.strip()
            if normalized not in enum_values:
                raise ApiException(
                    status_code=400,
                    code="invalid-enum-value",
                    message=f"{column_id} must be one of {sorted(enum_values)}",
                )
            return normalized

        if definition.value_type == "integer":
            if value is None or value == "":
                return None
            return self._normalize_edit_int(value)

        raise ApiException(
            status_code=400,
            code="unsupported-column",
            message=f"{column_id} is not editable",
        )

    def _normalize_edit_int(self, value: Any) -> int:
        if isinstance(value, bool):
            raise ApiException(
                status_code=400,
                code="invalid-integer-value",
                message="value edits must contain an integer",
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            normalized = value.strip()
            if normalized == "":
                raise ApiException(
                    status_code=400,
                    code="invalid-integer-value",
                    message="value edits must contain an integer",
                )
            if normalized.isdigit() or (
                normalized.startswith(("+", "-")) and normalized[1:].isdigit()
            ):
                return int(normalized)
        raise ApiException(
            status_code=400,
            code="invalid-integer-value",
            message="value edits must contain an integer",
        )

    def _current_edit_value(self, row: GridDemoRowModel, column_id: str) -> Any:
        return getattr(row, self._model_attribute_for_edit_column(column_id))

    def _model_attribute_for_edit_column(self, column_id: str) -> str:
        definition = self._column_definition(column_id)
        if definition is not None:
            return definition.model_attr
        raise ApiException(
            status_code=400,
            code="unsupported-column",
            message=f"{column_id} is not editable",
        )

    def _column_definition(self, column_id: str) -> ServerDemoColumnDefinition | None:
        return self._columns.get(column_id)

