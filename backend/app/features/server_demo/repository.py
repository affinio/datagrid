from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import (
    ServerDemoCommittedEdit,
    ServerDemoCommitEditsRequest,
    ServerDemoCommitEditsResponse,
    ServerDemoEditInvalidation,
    ServerDemoHistogramEntry,
    ServerDemoHistogramResponse,
    ServerDemoInvalidationRange,
    ServerDemoPullRequest,
    ServerDemoPullResponse,
    ServerDemoRejectedEdit,
    ServerDemoRow as ServerDemoRowSchema,
)

ALLOWED_SORT_COLUMNS = {
    "index": GridDemoRowModel.row_index,
    "name": GridDemoRowModel.name,
    "segment": GridDemoRowModel.segment,
    "status": GridDemoRowModel.status,
    "region": GridDemoRowModel.region,
    "value": GridDemoRowModel.value,
    "updatedAt": GridDemoRowModel.updated_at,
    "updated_at": GridDemoRowModel.updated_at,
}

ALLOWED_HISTOGRAM_COLUMNS = {"segment", "status", "region"}
EDITABLE_COLUMNS = {"name", "segment", "status", "region", "value"}
READONLY_COLUMNS = {"id", "index", "updatedAt", "updated_at"}
SEGMENT_VALUES = {"Core", "Growth", "Enterprise", "SMB"}
STATUS_VALUES = {"Active", "Paused", "Closed"}
REGION_VALUES = {"AMER", "EMEA", "APAC", "LATAM"}
ENUM_VALUES_BY_COLUMN = {
    "segment": SEGMENT_VALUES,
    "status": STATUS_VALUES,
    "region": REGION_VALUES,
}
INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")
OPERATION_STATUS_APPLIED = "applied"
OPERATION_STATUS_UNDONE = "undone"


@dataclass(frozen=True)
class PendingCellEvent:
    row: GridDemoRowModel
    column_id: str
    before_value: Any
    after_value: Any


@dataclass(frozen=True)
class PreparedHistoryCellEvent:
    event: ServerDemoCellEventModel
    row: GridDemoRowModel
    target_value: Any


class ServerDemoRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def health(self) -> None:
        await self._session.scalar(select(func.max(GridDemoRowModel.row_index)))

    async def pull(self, request: ServerDemoPullRequest) -> ServerDemoPullResponse:
        conditions = self._build_filter_conditions(request.filter_model)
        stmt = self._build_filtered_row_query(conditions)
        stmt = stmt.order_by(*self._build_order_by(request.sort_model))
        stmt = stmt.offset(request.range.start_row).limit(request.range.end_row - request.range.start_row)

        rows = (await self._session.scalars(stmt)).all()
        total = await self._count_rows(conditions)
        revision = await self._revision_token()
        return ServerDemoPullResponse(
            rows=[self._to_row(row) for row in rows],
            total=total,
            revision=revision,
        )

    async def histogram(self, column_id: str, filter_model: dict[str, Any] | None) -> ServerDemoHistogramResponse:
        if column_id == "value":
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message="Value histograms are not implemented yet",
            )
        if column_id not in ALLOWED_HISTOGRAM_COLUMNS:
            raise ApiException(
                status_code=400,
                code="unsupported_histogram_column",
                message=f"Histogram is only supported for {sorted(ALLOWED_HISTOGRAM_COLUMNS)}",
            )

        column = getattr(GridDemoRowModel, column_id)
        conditions = self._build_filter_conditions(filter_model)
        stmt = (
            select(column, func.count())
            .select_from(GridDemoRowModel)
            .where(*conditions)
            .group_by(column)
            .order_by(column)
        )
        result = await self._session.execute(stmt)
        return ServerDemoHistogramResponse(
            column_id=column_id,
            entries=[ServerDemoHistogramEntry(value=value, count=count) for value, count in result.all()],
        )

    async def commit_edits(self, request: ServerDemoCommitEditsRequest) -> ServerDemoCommitEditsResponse:
        requested_operation_id = self._normalize_optional_operation_id(request.operation_id)
        operation_id: str | None = None
        committed: list[ServerDemoCommittedEdit] = []
        rejected: list[ServerDemoRejectedEdit] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []
        row_ids = list(dict.fromkeys(edit.row_id for edit in request.edits))

        async with self._session.begin():
            rows_by_id: dict[str, GridDemoRowModel] = {}
            if row_ids:
                stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids)).with_for_update()
                rows = (await self._session.scalars(stmt)).all()
                rows_by_id = {row.id: row for row in rows}

            changed_rows: dict[str, GridDemoRowModel] = {}
            changed_at = datetime.now(timezone.utc)
            cell_events: list[PendingCellEvent] = []

            for edit in request.edits:
                column_id = edit.column_id
                row = rows_by_id.get(edit.row_id)

                reject_reason = self._reject_reason_for_edit(row, column_id)
                if reject_reason is not None:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, reject_reason))
                    continue

                try:
                    next_value = self._normalize_edit_value(column_id, edit.value)
                    previous_value = (
                        self._normalize_edit_value(column_id, edit.previous_value)
                        if edit.previous_value is not None
                        else None
                    )
                except ApiException as exc:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, exc.code))
                    continue

                current_value = self._current_edit_value(row, column_id)
                if edit.previous_value is not None and previous_value != current_value:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, "previous-value-mismatch"))
                    continue

                before_value = self._json_edit_value(current_value)
                if next_value != current_value:
                    setattr(row, self._model_attribute_for_edit_column(column_id), next_value)
                    row.updated_at = changed_at
                    changed_rows[row.id] = row

                cell_events.append(
                    PendingCellEvent(
                        row=row,
                        column_id=column_id,
                        before_value=before_value,
                        after_value=self._json_edit_value(next_value),
                    )
                )
                committed.append(
                    ServerDemoCommittedEdit(
                        row_id=row.id,
                        column_id=column_id,
                        revision=row.updated_at.isoformat(),
                    )
                )
                if row.id not in committed_row_ids:
                    committed_row_ids.append(row.id)

            if changed_rows:
                await self._session.flush()
                affected_indexes = [row.row_index for row in changed_rows.values()]
            if cell_events:
                operation_id = requested_operation_id or self._create_edit_operation_id()
                await self._ensure_operation_id_available(operation_id)
                self._session.add(
                    ServerDemoOperationModel(
                        operation_id=operation_id,
                        operation_type="edit",
                        status=OPERATION_STATUS_APPLIED,
                        operation_metadata={},
                        revision=changed_at,
                        created_at=changed_at,
                        modified_at=changed_at,
                    )
                )
                await self._session.flush()
                self._session.add_all(
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
                    ]
                )

            revision = await self._revision_token()

        return ServerDemoCommitEditsResponse(
            operation_id=operation_id,
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            revision=revision,
            invalidation=self._build_edit_invalidation(affected_indexes),
        )

    async def undo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        return await self._apply_history_operation(operation_id, "undo")

    async def redo_operation(self, operation_id: str) -> ServerDemoCommitEditsResponse:
        return await self._apply_history_operation(operation_id, "redo")

    def _normalize_optional_operation_id(self, operation_id: str | None) -> str | None:
        normalized = operation_id.strip() if operation_id else ""
        return normalized if normalized else None

    def _require_operation_id(self, operation_id: str) -> str:
        normalized = operation_id.strip()
        if normalized:
            return normalized
        raise ApiException(
            status_code=400,
            code="invalid-operation-id",
            message="operation_id must not be empty",
        )

    def _create_edit_operation_id(self) -> str:
        return f"edit-{uuid4()}"

    async def _ensure_operation_id_available(self, operation_id: str) -> None:
        existing_count = await self._session.scalar(
            select(func.count())
            .select_from(ServerDemoOperationModel)
            .where(ServerDemoOperationModel.operation_id == operation_id)
        )
        if existing_count:
            raise ApiException(
                status_code=409,
                code="duplicate-operation-id",
                message=f"Edit operation {operation_id} already exists",
            )

    async def _apply_history_operation(
        self,
        raw_operation_id: str,
        action: str,
    ) -> ServerDemoCommitEditsResponse:
        operation_id = self._require_operation_id(raw_operation_id)

        committed: list[ServerDemoCommittedEdit] = []
        rejected: list[ServerDemoRejectedEdit] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []

        async with self._session.begin():
            operation = await self._session.scalar(
                select(ServerDemoOperationModel)
                .where(ServerDemoOperationModel.operation_id == operation_id)
                .with_for_update()
            )
            if operation is None:
                raise ApiException(
                    status_code=404,
                    code="operation-not-found",
                    message=f"Operation {operation_id} was not found",
                )

            if action == "undo":
                if operation.status != OPERATION_STATUS_APPLIED:
                    raise ApiException(
                        status_code=409,
                        code="operation-already-undone",
                        message=f"Operation {operation_id} is not currently applied",
                    )
                next_status = OPERATION_STATUS_UNDONE
            else:
                if operation.status != OPERATION_STATUS_UNDONE:
                    raise ApiException(
                        status_code=409,
                        code="operation-not-undone",
                        message=f"Operation {operation_id} must be undone before redo",
                    )
                next_status = OPERATION_STATUS_APPLIED

            cell_events = (
                await self._session.scalars(
                    select(ServerDemoCellEventModel)
                    .where(ServerDemoCellEventModel.operation_id == operation_id)
                    .order_by(ServerDemoCellEventModel.created_at.asc(), ServerDemoCellEventModel.event_id.asc())
                )
            ).all()

            if not cell_events:
                raise ApiException(
                    status_code=409,
                    code="operation-has-no-cell-events",
                    message=f"Operation {operation_id} has no cell events",
                )

            row_ids = list(dict.fromkeys(event.row_id for event in cell_events))
            rows = (
                await self._session.scalars(
                    select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids)).with_for_update()
                )
            ).all()
            rows_by_id = {row.id: row for row in rows}

            prepared_events: list[PreparedHistoryCellEvent] = []
            for cell_event in cell_events:
                row = rows_by_id.get(cell_event.row_id)
                reject_reason = self._reject_reason_for_edit(row, cell_event.column_key)
                if reject_reason is not None:
                    rejected.append(self._rejected_edit(cell_event.row_id, cell_event.column_key, reject_reason))
                    continue

                try:
                    target_value = self._normalize_edit_value(
                        cell_event.column_key,
                        cell_event.before_value if action == "undo" else cell_event.after_value,
                    )
                except ApiException as exc:
                    rejected.append(self._rejected_edit(cell_event.row_id, cell_event.column_key, exc.code))
                    continue

                prepared_events.append(
                    PreparedHistoryCellEvent(
                        event=cell_event,
                        row=row,
                        target_value=target_value,
                    )
                )

            if rejected:
                revision = await self._revision_token()
                return ServerDemoCommitEditsResponse(
                    operation_id=operation_id,
                    committed=[],
                    committed_row_ids=[],
                    rejected=rejected,
                    revision=revision,
                    invalidation=None,
                )

            changed_rows: dict[str, GridDemoRowModel] = {}
            changed_at = datetime.now(timezone.utc)

            for prepared_event in prepared_events:
                current_value = self._current_edit_value(prepared_event.row, prepared_event.event.column_key)
                if prepared_event.target_value != current_value:
                    setattr(
                        prepared_event.row,
                        self._model_attribute_for_edit_column(prepared_event.event.column_key),
                        prepared_event.target_value,
                    )
                    prepared_event.row.updated_at = changed_at
                    changed_rows[prepared_event.row.id] = prepared_event.row

                committed.append(
                    ServerDemoCommittedEdit(
                        row_id=prepared_event.row.id,
                        column_id=prepared_event.event.column_key,
                        revision=prepared_event.row.updated_at.isoformat(),
                    )
                )
                if prepared_event.row.id not in committed_row_ids:
                    committed_row_ids.append(prepared_event.row.id)

            if changed_rows:
                await self._session.flush()
                affected_indexes = [row.row_index for row in changed_rows.values()]
            operation.status = next_status
            operation.modified_at = changed_at
            operation.revision = changed_at

            revision = await self._revision_token()

        return ServerDemoCommitEditsResponse(
            operation_id=operation_id,
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            revision=revision,
            invalidation=self._build_edit_invalidation(affected_indexes),
        )

    def _build_filtered_row_query(self, conditions: Sequence[Any]):
        return select(GridDemoRowModel).where(*conditions)

    async def _count_rows(self, conditions: Sequence[Any]) -> int:
        stmt = select(func.count()).select_from(GridDemoRowModel).where(*conditions)
        return int(await self._session.scalar(stmt) or 0)

    async def _revision_token(self) -> str:
        stmt = select(func.max(GridDemoRowModel.updated_at)).select_from(GridDemoRowModel)
        revision = await self._session.scalar(stmt)
        if revision is None:
            return "empty"
        return revision.isoformat()

    def _build_order_by(self, sort_model: Sequence[Any]) -> list[Any]:
        order_by: list[Any] = []
        seen_columns: set[str] = set()

        for item in sort_model:
            column_id = self._sort_column_id(item)
            direction = self._sort_direction(item)
            if column_id is None or direction is None:
                continue

            column = ALLOWED_SORT_COLUMNS.get(column_id)
            if column is None:
                continue

            seen_columns.add(column_id)
            order_by.append(column.desc() if direction == "desc" else column.asc())

        if "index" not in seen_columns:
            order_by.append(GridDemoRowModel.row_index.asc())

        return order_by

    def _build_filter_conditions(self, filter_model: dict[str, Any] | None) -> list[Any]:
        if not filter_model:
            return []

        conditions: list[Any] = []

        for column_id, raw_filter in filter_model.items():
            if column_id in {"segment", "status", "region"}:
                values = self._extract_filter_values(raw_filter)
                if len(values) == 1:
                    conditions.append(getattr(GridDemoRowModel, column_id) == values[0])
                elif len(values) > 1:
                    conditions.append(getattr(GridDemoRowModel, column_id).in_(values))
            elif column_id == "name":
                value = self._extract_filter_value(raw_filter)
                if value:
                    conditions.append(GridDemoRowModel.name.ilike(f"%{value}%"))
            elif column_id == "value":
                conditions.extend(self._build_value_conditions(raw_filter))

        return conditions

    def _build_value_conditions(self, raw_filter: Any) -> list[Any]:
        if not isinstance(raw_filter, dict):
            return []

        conditions: list[Any] = []
        min_value = raw_filter.get("min")
        max_value = raw_filter.get("max")
        if min_value is not None:
            coerced_min = self._coerce_optional_int(min_value)
            if coerced_min is not None:
                conditions.append(GridDemoRowModel.value >= coerced_min)
        if max_value is not None:
            coerced_max = self._coerce_optional_int(max_value)
            if coerced_max is not None:
                conditions.append(GridDemoRowModel.value <= coerced_max)

        filter_type = raw_filter.get("type")
        primary = raw_filter.get("filter")
        secondary = raw_filter.get("filterTo")

        if filter_type == "equals" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(GridDemoRowModel.value == coerced_primary)
        elif filter_type == "greaterThan" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(GridDemoRowModel.value > coerced_primary)
        elif filter_type == "greaterThanOrEqual" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(GridDemoRowModel.value >= coerced_primary)
        elif filter_type == "lessThan" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(GridDemoRowModel.value < coerced_primary)
        elif filter_type == "lessThanOrEqual" and primary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            if coerced_primary is not None:
                conditions.append(GridDemoRowModel.value <= coerced_primary)
        elif filter_type == "inRange" and primary is not None and secondary is not None:
            coerced_primary = self._coerce_optional_int(primary)
            coerced_secondary = self._coerce_optional_int(secondary)
            if coerced_primary is not None and coerced_secondary is not None:
                conditions.append(GridDemoRowModel.value >= coerced_primary)
                conditions.append(GridDemoRowModel.value <= coerced_secondary)

        return conditions

    def _extract_filter_value(self, raw_filter: Any) -> Any:
        values = self._extract_filter_values(raw_filter)
        if not values:
            return None
        return values[0]

    def _extract_filter_values(self, raw_filter: Any) -> list[Any]:
        if isinstance(raw_filter, dict):
            if "values" in raw_filter and isinstance(raw_filter["values"], (list, tuple, set)):
                values = [self._normalize_filter_scalar(value) for value in raw_filter["values"]]
                return [value for value in values if value is not None]
            if "filter" in raw_filter:
                value = self._normalize_filter_scalar(raw_filter["filter"])
                return [value] if value is not None else []
            if "value" in raw_filter:
                value = self._normalize_filter_scalar(raw_filter["value"])
                return [value] if value is not None else []
            if "tokens" in raw_filter and isinstance(raw_filter["tokens"], (list, tuple, set)):
                values = [self._normalize_filter_scalar(value) for value in raw_filter["tokens"]]
                return [value for value in values if value is not None]
            return []
        if isinstance(raw_filter, (list, tuple, set)):
            values = [self._normalize_filter_scalar(value) for value in raw_filter]
            return [value for value in values if value is not None]
        value = self._normalize_filter_scalar(raw_filter)
        return [value] if value is not None else []

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

    def _coerce_int(self, value: Any) -> int:
        coerced = self._coerce_optional_int(value)
        if coerced is None:
            raise ApiException(
                status_code=400,
                code="invalid_filter",
                message="Numeric filters must contain integer values",
            )
        return coerced

    def _reject_reason_for_edit(self, row: GridDemoRowModel | None, column_id: str) -> str | None:
        if column_id in READONLY_COLUMNS:
            return "readonly-column"
        if column_id not in EDITABLE_COLUMNS:
            return "unsupported-column"
        if row is None:
            return "row-not-found"
        return None

    def _json_edit_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _normalize_edit_value(self, column_id: str, value: Any) -> Any:
        if column_id == "name":
            if value is None:
                raise ApiException(
                    status_code=400,
                    code="invalid-value",
                    message="name edits must contain a string value",
                )
            return str(value)

        enum_values = ENUM_VALUES_BY_COLUMN.get(column_id)
        if enum_values is not None:
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

        if column_id == "value":
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
            if INTEGER_PATTERN.match(normalized):
                return int(normalized)
        raise ApiException(
            status_code=400,
            code="invalid-integer-value",
            message="value edits must contain an integer",
        )

    def _current_edit_value(self, row: GridDemoRowModel, column_id: str) -> Any:
        return getattr(row, self._model_attribute_for_edit_column(column_id))

    def _model_attribute_for_edit_column(self, column_id: str) -> str:
        if column_id == "value":
            return "value"
        if column_id == "name":
            return "name"
        if column_id == "segment":
            return "segment"
        if column_id == "status":
            return "status"
        if column_id == "region":
            return "region"
        raise ApiException(
            status_code=400,
            code="unsupported-column",
            message=f"{column_id} is not editable",
        )

    def _build_edit_invalidation(self, affected_indexes: Sequence[int]) -> ServerDemoEditInvalidation | None:
        if not affected_indexes:
            return None
        return ServerDemoEditInvalidation(
            kind="range",
            range=ServerDemoInvalidationRange(
                start=min(affected_indexes),
                end=max(affected_indexes),
            ),
            reason="server-demo-edits",
        )

    def _rejected_edit(self, row_id: str, column_id: str, reason: str) -> ServerDemoRejectedEdit:
        return ServerDemoRejectedEdit(row_id=row_id, column_id=column_id, reason=reason)

    def _sort_column_id(self, item: Any) -> str | None:
        if hasattr(item, "resolved_column_id"):
            return item.resolved_column_id()
        if isinstance(item, dict):
            return item.get("colId") or item.get("key")
        return None

    def _sort_direction(self, item: Any) -> str | None:
        if hasattr(item, "resolved_direction"):
            direction = item.resolved_direction()
        elif isinstance(item, dict):
            direction = item.get("sort") or item.get("direction")
        else:
            direction = None

        if direction is None:
            return None
        normalized = str(direction).lower()
        if normalized not in {"asc", "desc"}:
            return None
        return normalized

    def _to_row(self, row: GridDemoRowModel) -> ServerDemoRowSchema:
        return ServerDemoRowSchema(
            id=row.id,
            index=row.row_index,
            name=row.name,
            segment=row.segment,
            status=row.status,
            region=row.region,
            value=row.value,
            updated_at=row.updated_at,
        )
