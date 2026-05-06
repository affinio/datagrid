from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from affino_grid_backend.core.errors import ApiException
from affino_grid_backend.core.mutations import GridCommittedCell, GridHistoryApplyResult, GridRejectedCell
from affino_grid_backend.core.revision import GridRevisionService
from affino_grid_backend.core.table import GridTableDefinition
from affino_grid_backend.core.values import normalize_edit_int, normalize_edit_value, reject_reason_for_column


class GridHistoryServiceBase(ABC):
    def __init__(self, table: GridTableDefinition, revision_service: GridRevisionService):
        self._table = table
        self._revision_service = revision_service

    async def apply_operation(
        self,
        session: AsyncSession,
        raw_operation_id: str,
        action: Literal["undo", "redo"],
    ) -> GridHistoryApplyResult:
        operation_id = self._require_operation_id(raw_operation_id)

        async with session.begin():
            operation = await self.get_operation(session, operation_id, with_for_update=True)
            if operation is None:
                raise ApiException(
                    status_code=404,
                    code="operation-not-found",
                    message=f"Operation {operation_id} was not found",
                )

            return await self.apply_loaded_operation(session, operation, action)

    async def apply_loaded_operation(
        self,
        session: AsyncSession,
        operation: Any,
        action: Literal["undo", "redo"],
    ) -> GridHistoryApplyResult:
        operation_id = self.get_operation_id(operation)
        committed: list[GridCommittedCell] = []
        rejected: list[GridRejectedCell] = []
        committed_row_ids: list[str] = []
        affected_indexes: list[int] = []

        if action == "undo":
            if self.get_operation_status(operation) != "applied":
                raise ApiException(
                    status_code=409,
                    code="operation-already-undone",
                    message=f"Operation {operation_id} is not currently applied",
                )
            next_status = "undone"
        else:
            if self.get_operation_status(operation) != "undone":
                raise ApiException(
                    status_code=409,
                    code="operation-not-undone",
                    message=f"Operation {operation_id} must be undone before redo",
                )
            next_status = "applied"

        operation_workspace_id = getattr(operation, "workspace_id", None)
        operation_table_id = getattr(operation, "table_id", None)
        cell_events = await self.load_cell_events(
            session,
            operation_id,
            workspace_id=operation_workspace_id,
            table_id=operation_table_id,
        )
        if not cell_events and operation_workspace_id is not None:
            cell_events = await self.load_cell_events(
                session,
                operation_id,
                workspace_id=None,
                table_id=operation_table_id,
                force_unscoped=True,
            )
        if not cell_events:
            raise ApiException(
                status_code=409,
                code="operation-has-no-cell-events",
                message=f"Operation {operation_id} has no cell events",
            )

        row_ids = list(dict.fromkeys(self.event_row_id(event) for event in cell_events))
        rows_by_id = await self.fetch_rows_by_ids(
            session,
            row_ids,
            with_for_update=True,
            workspace_id=operation_workspace_id,
            table_id=operation_table_id,
        )
        if not rows_by_id and operation_workspace_id is not None:
            rows_by_id = await self.fetch_rows_by_ids(
                session,
                row_ids,
                with_for_update=True,
                workspace_id=None,
                table_id=operation_table_id,
                force_unscoped=True,
            )

        prepared_events: list[tuple[Any, Any, Any, str, str]] = []
        for event in cell_events:
            row_id = self.event_row_id(event)
            column_id = self.event_column_id(event)
            row = rows_by_id.get(row_id)
            reject_reason = reject_reason_for_column(self._table.column(column_id), row is not None)
            if reject_reason is not None:
                rejected.append(GridRejectedCell(row_id=row_id, column_id=column_id, reason=reject_reason))
                continue

            try:
                raw_value = self.event_before_value(event) if action == "undo" else self.event_after_value(event)
                target_value = self.normalize_edit_value(column_id, raw_value)
            except ApiException as exc:
                rejected.append(GridRejectedCell(row_id=row_id, column_id=column_id, reason=exc.code))
                continue

            prepared_events.append((event, row, target_value, row_id, column_id))

        if rejected:
            revision = await self._revision_service.get_revision(session)
            return GridHistoryApplyResult(
                operation_id=operation_id,
                operation_type=self.get_operation_type(operation),
                committed=[],
                committed_row_ids=[],
                rejected=rejected,
                affected_indexes=[],
                revision=revision,
                rows=[],
            )

        changed_rows: dict[str, Any] = {}
        changed_at = datetime.now(timezone.utc)

        for _, row, target_value, row_id, column_id in prepared_events:
            current_value = self.get_row_value(row, column_id)
            if target_value != current_value:
                self.set_row_value(row, column_id, target_value)
                self.set_row_updated_at(row, changed_at)
                changed_rows[self.get_row_id(row)] = row

            committed.append(
                GridCommittedCell(
                    row_id=row_id,
                    column_id=column_id,
                    revision=self.get_row_revision(row),
                )
            )
            if row_id not in committed_row_ids:
                committed_row_ids.append(row_id)

        if changed_rows:
            await session.flush()
            affected_indexes = [self.get_row_index(row) for row in changed_rows.values()]
        self.set_operation_status(operation, next_status)
        self.set_operation_modified_at(operation, changed_at)
        self.set_operation_revision(operation, changed_at)
        revision = await self._revision_service.bump_revision(session)

        return GridHistoryApplyResult(
            operation_id=operation_id,
            operation_type=self.get_operation_type(operation),
            committed=committed,
            committed_row_ids=committed_row_ids,
            rejected=rejected,
            affected_indexes=affected_indexes,
            revision=revision,
            rows=list(changed_rows.values()),
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

    def normalize_edit_value(self, column_id: str, value: Any) -> Any:
        definition = self._table.column(column_id)
        if definition is None or not definition.editable:
            raise ApiException(
                status_code=400,
                code="unsupported-column",
                message=f"{column_id} is not editable",
            )
        return normalize_edit_value(definition, value)

    def normalize_edit_int(self, value: Any) -> int:
        return normalize_edit_int(value)

    @abstractmethod
    async def get_operation(self, session: AsyncSession, operation_id: str, *, with_for_update: bool = False) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_operation_id(self, operation: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_operation_type(self, operation: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_operation_status(self, operation: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def set_operation_status(self, operation: Any, status: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def set_operation_modified_at(self, operation: Any, changed_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    def set_operation_revision(self, operation: Any, changed_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    async def load_cell_events(
        self,
        session: AsyncSession,
        operation_id: str,
        *,
        workspace_id: str | None = None,
        table_id: str | None = None,
        force_unscoped: bool = False,
    ) -> Sequence[Any]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_rows_by_ids(
        self,
        session: AsyncSession,
        row_ids: Sequence[str],
        *,
        with_for_update: bool = False,
        workspace_id: str | None = None,
        table_id: str | None = None,
        force_unscoped: bool = False,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def event_row_id(self, event: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def event_column_id(self, event: Any) -> str:
        raise NotImplementedError

    @abstractmethod
    def event_before_value(self, event: Any) -> Any:
        raise NotImplementedError

    @abstractmethod
    def event_after_value(self, event: Any) -> Any:
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

    @abstractmethod
    def get_row_revision(self, row: Any) -> str:
        raise NotImplementedError
