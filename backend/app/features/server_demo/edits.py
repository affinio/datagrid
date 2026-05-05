from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.features.server_demo.columns import ServerDemoColumnDefinition
from app.features.server_demo.models import ServerDemoCellEvent as ServerDemoCellEventModel
from app.features.server_demo.models import ServerDemoOperation as ServerDemoOperationModel
from app.features.server_demo.models import GridDemoRow as GridDemoRowModel
from app.features.server_demo.schemas import (
    ServerDemoCommittedEdit,
    ServerDemoCommitEditsRequest,
    ServerDemoRejectedEdit,
)

INTEGER_PATTERN = re.compile(r"^[+-]?\d+$")
OPERATION_STATUS_APPLIED = "applied"


@dataclass(frozen=True)
class PendingCellEvent:
    row: GridDemoRowModel
    column_id: str
    before_value: Any
    after_value: Any


@dataclass(frozen=True)
class ServerDemoEditCommitResult:
    operation_id: str | None
    committed: list[ServerDemoCommittedEdit]
    committed_row_ids: list[str]
    rejected: list[ServerDemoRejectedEdit]
    affected_indexes: list[int]


class ServerDemoEditService:
    def __init__(self, columns: Mapping[str, ServerDemoColumnDefinition]):
        self._columns = columns

    async def commit_edits(
        self,
        session: AsyncSession,
        request: ServerDemoCommitEditsRequest,
    ) -> ServerDemoEditCommitResult:
        requested_operation_id = self._normalize_optional_operation_id(request.operation_id)
        operation_id: str | None = None
        committed: list[ServerDemoCommittedEdit] = []
        rejected: list[ServerDemoRejectedEdit] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []
        row_ids = list(dict.fromkeys(edit.row_id for edit in request.edits))

        async with session.begin():
            rows_by_id: dict[str, GridDemoRowModel] = {}
            if row_ids:
                stmt = select(GridDemoRowModel).where(GridDemoRowModel.id.in_(row_ids)).with_for_update()
                rows = (await session.scalars(stmt)).all()
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
                await session.flush()
                affected_indexes = [row.row_index for row in changed_rows.values()]
            if cell_events:
                operation_id = requested_operation_id or self._create_edit_operation_id()
                await self._ensure_operation_id_available(session, operation_id)
                session.add(
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
                    ]
                )

        return ServerDemoEditCommitResult(
            operation_id=operation_id,
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            affected_indexes=affected_indexes,
        )

    def _normalize_optional_operation_id(self, operation_id: str | None) -> str | None:
        normalized = operation_id.strip() if operation_id else ""
        return normalized if normalized else None

    def _create_edit_operation_id(self) -> str:
        return f"edit-{uuid4()}"

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

    def _json_edit_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _column_definition(self, column_id: str) -> ServerDemoColumnDefinition | None:
        return self._columns.get(column_id)
