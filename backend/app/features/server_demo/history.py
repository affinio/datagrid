from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.columns import ServerDemoColumnDefinition
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import ServerDemoCommittedEdit, ServerDemoRejectedEdit

INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")
OPERATION_STATUS_APPLIED = "applied"
OPERATION_STATUS_UNDONE = "undone"


@dataclass(frozen=True)
class PendingHistoryCellEvent:
    event: ServerDemoCellEventModel
    row: GridDemoRowModel
    target_value: Any


@dataclass(frozen=True)
class ServerDemoHistoryApplyResult:
    operation_id: str
    operation_type: str
    committed: list[ServerDemoCommittedEdit]
    committed_row_ids: list[str]
    rejected: list[ServerDemoRejectedEdit]
    affected_indexes: list[int]


class ServerDemoHistoryService:
    def __init__(self, columns: Mapping[str, ServerDemoColumnDefinition]):
        self._columns = columns

    async def undo_operation(self, session: AsyncSession, operation_id: str) -> ServerDemoHistoryApplyResult:
        return await self._apply_history_operation(session, operation_id, "undo")

    async def redo_operation(self, session: AsyncSession, operation_id: str) -> ServerDemoHistoryApplyResult:
        return await self._apply_history_operation(session, operation_id, "redo")

    async def _apply_history_operation(
        self,
        session: AsyncSession,
        raw_operation_id: str,
        action: str,
    ) -> ServerDemoHistoryApplyResult:
        operation_id = self._require_operation_id(raw_operation_id)

        committed: list[ServerDemoCommittedEdit] = []
        rejected: list[ServerDemoRejectedEdit] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []

        async with session.begin():
            operation = await session.scalar(
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
                await session.scalars(
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
                await session.scalars(
                    select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids)).with_for_update()
                )
            ).all()
            rows_by_id = {row.id: row for row in rows}

            prepared_events: list[PendingHistoryCellEvent] = []
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
                    PendingHistoryCellEvent(
                        event=cell_event,
                        row=row,
                        target_value=target_value,
                    )
                )

            if rejected:
                return ServerDemoHistoryApplyResult(
                    operation_id=operation_id,
                    operation_type=operation.operation_type,
                    committed=[],
                    committed_row_ids=[],
                    rejected=rejected,
                    affected_indexes=[],
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
                await session.flush()
                affected_indexes = [row.row_index for row in changed_rows.values()]
            operation.status = next_status
            operation.modified_at = changed_at
            operation.revision = changed_at

        return ServerDemoHistoryApplyResult(
            operation_id=operation_id,
            operation_type=operation.operation_type,
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            affected_indexes=affected_indexes,
        )

    def _require_operation_id(self, operation_id: str) -> str:
        normalized = operation_id.strip()
        if normalized:
            return normalized
        raise ApiException(
            status_code=400,
            code="invalid-operation-id",
            message="operation_id must not be empty",
        )

    def _rejected_edit(self, row_id: str, column_id: str, reason: str) -> ServerDemoRejectedEdit:
        return ServerDemoRejectedEdit(row_id=row_id, column_id=column_id, reason=reason)

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

