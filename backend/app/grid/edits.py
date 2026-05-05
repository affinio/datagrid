from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import ApiException
from app.grid.columns import GridColumnDefinition
from app.grid.mutations import GridCommittedCell, GridMutationResult, GridRejectedCell, PendingGridCellEvent
from app.grid.revision import GridRevisionService
from app.grid.table import GridTableDefinition
from app.grid.values import json_edit_value, normalize_edit_int, normalize_edit_value, reject_reason_for_column


class GridEditServiceBase(ABC):
    operation_type = "edit"

    def __init__(
        self,
        table: GridTableDefinition,
        revision_service: GridRevisionService,
        *,
        max_batch_edits: int = 500,
    ):
        self._table = table
        self._revision_service = revision_service
        self._max_batch_edits = max(0, int(max_batch_edits))

    async def commit_edits(self, session: AsyncSession, request: Any) -> GridMutationResult:
        if len(request.edits) > self._max_batch_edits:
            raise ApiException(
                status_code=400,
                code="too-many-edits",
                message="Batch edit size exceeds limit",
            )

        requested_operation_id = self.normalize_optional_operation_id(getattr(request, "operation_id", None))
        operation_id: str | None = None
        committed: list[GridCommittedCell] = []
        rejected: list[GridRejectedCell] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []
        row_ids = list(dict.fromkeys(edit.row_id for edit in request.edits))

        async with session.begin():
            base_revision = getattr(request, "base_revision", None)
            if base_revision is not None:
                current_revision = await self._revision_service.get_revision(session)
                if base_revision != current_revision:
                    raise ApiException(
                        status_code=409,
                        code="stale-revision",
                        message="Edit commit revision is stale",
                    )

            rows_by_id = await self.fetch_rows_by_ids(session, row_ids, with_for_update=True)

            changed_rows: dict[str, Any] = {}
            changed_at = datetime.now(timezone.utc)
            cell_events: list[PendingGridCellEvent] = []

            for edit in request.edits:
                column_id = edit.column_id
                row = rows_by_id.get(edit.row_id)

                reject_reason = self.reject_reason_for_edit(row, column_id)
                if reject_reason is not None:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, reject_reason))
                    continue

                try:
                    next_value = self.normalize_edit_value(column_id, edit.value)
                    previous_value = (
                        self.normalize_edit_value(column_id, edit.previous_value)
                        if edit.previous_value is not None
                        else None
                    )
                except ApiException as exc:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, exc.code))
                    continue

                current_value = self.get_row_value(row, column_id)
                if edit.previous_value is not None and previous_value != current_value:
                    rejected.append(self._rejected_edit(edit.row_id, column_id, "previous-value-mismatch"))
                    continue

                before_value = json_edit_value(current_value)
                if next_value != current_value:
                    self.set_row_value(row, column_id, next_value)
                    self.set_row_updated_at(row, changed_at)
                    changed_rows[self.get_row_id(row)] = row

                cell_events.append(
                    PendingGridCellEvent(
                        row=row,
                        row_id=self.get_row_id(row),
                        column_id=column_id,
                        before_value=before_value,
                        after_value=json_edit_value(next_value),
                    )
                )
                committed.append(
                    GridCommittedCell(
                        row_id=self.get_row_id(row),
                        column_id=column_id,
                        revision=self.get_row_revision(row),
                    )
                )
                if self.get_row_id(row) not in committed_row_ids:
                    committed_row_ids.append(self.get_row_id(row))

            if changed_rows:
                await session.flush()
                affected_indexes = [self.get_row_index(row) for row in changed_rows.values()]
            if cell_events:
                operation_id = requested_operation_id or self.create_edit_operation_id()
                await self.ensure_operation_id_available(session, operation_id)
                await self.create_operation(session, operation_id, changed_at)
                await session.flush()
                await self.create_cell_events(session, operation_id, cell_events, changed_at)

            revision = await self._revision_service.bump_revision(session) if changed_rows else await self._revision_service.get_revision(session)

        return GridMutationResult(
            operation_id=operation_id,
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            affected_indexes=affected_indexes,
            revision=revision,
        )

    def normalize_optional_operation_id(self, operation_id: str | None) -> str | None:
        normalized = operation_id.strip() if operation_id else ""
        return normalized if normalized else None

    def create_edit_operation_id(self) -> str:
        return f"edit-{uuid4()}"

    def reject_reason_for_edit(self, row: Any | None, column_id: str) -> str | None:
        return reject_reason_for_column(self.column_definition(column_id), row is not None)

    def normalize_edit_value(self, column_id: str, value: Any) -> Any:
        definition = self.column_definition(column_id)
        if definition is None or not definition.editable:
            raise ApiException(
                status_code=400,
                code="unsupported-column",
                message=f"{column_id} is not editable",
            )
        return normalize_edit_value(definition, value)

    def normalize_edit_int(self, value: Any) -> int:
        return normalize_edit_int(value)

    def column_definition(self, column_id: str) -> GridColumnDefinition | None:
        return self._table.column(column_id)

    def _rejected_edit(self, row_id: str, column_id: str, reason: str) -> GridRejectedCell:
        return GridRejectedCell(row_id=row_id, column_id=column_id, reason=reason)

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
    async def create_operation(self, session: AsyncSession, operation_id: str, changed_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    async def create_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        cell_events: Sequence[PendingGridCellEvent],
        changed_at: datetime,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def set_row_value(self, row: Any, column_id: str, value: Any) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_row_value(self, row: Any, column_id: str) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_row_id(self, row: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_row_index(self, row: Any) -> int:
        raise NotImplementedError

    @abstractmethod
    def set_row_updated_at(self, row: Any, changed_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_row_revision(self, row: Any) -> str:
        raise NotImplementedError
