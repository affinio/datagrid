from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Table, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from affino_grid_backend.core.revision_models import GridRevision
from affino_grid_backend.core.table import GridTableDefinition


class GridRevisionService:
    def __init__(
        self,
        table: GridTableDefinition,
        workspace_id: str | None = None,
        revision_table: Table = GridRevision,
    ):
        self._table = table
        self._workspace_id = workspace_id
        self._revision_table = revision_table

    async def get_revision(self, session: AsyncSession) -> str:
        record = await session.scalar(select(self._revision_table.c.revision).where(self._scope_predicate()))
        if record is None:
            return "0"
        return str(int(record))

    async def bump_revision(self, session: AsyncSession) -> str:
        if not session.in_transaction():
            raise RuntimeError("bump_revision requires an open transaction")
        revision = await self._lock_revision_row(session)
        if revision is not None:
            new_revision = int(revision) + 1
            await session.execute(
                self._revision_table.update()
                .where(self._scope_predicate())
                .values(revision=new_revision, updated_at=datetime.now(timezone.utc))
            )
            await session.flush()
            return str(new_revision)

        return await self._create_revision_row(session)

    async def _lock_revision_row(self, session: AsyncSession) -> int | None:
        stmt = select(self._revision_table.c.revision).where(self._scope_predicate()).with_for_update()
        return await session.scalar(stmt)

    async def _create_revision_row(self, session: AsyncSession) -> str:
        now = datetime.now(timezone.utc)
        insert_stmt = self._revision_insert(session).values(
            table_id=self._table.table_id,
            workspace_id=self._workspace_id,
            revision=1,
            updated_at=now,
        )
        if self._workspace_id is None:
            upsert_stmt = insert_stmt.on_conflict_do_update(
                index_elements=[self._revision_table.c.table_id],
                index_where=self._revision_table.c.workspace_id.is_(None),
                set_={
                    "revision": self._revision_table.c.revision + 1,
                    "updated_at": now,
                },
            )
        else:
            upsert_stmt = insert_stmt.on_conflict_do_update(
                index_elements=[self._revision_table.c.table_id, self._revision_table.c.workspace_id],
                index_where=self._revision_table.c.workspace_id.is_not(None),
                set_={
                    "revision": self._revision_table.c.revision + 1,
                    "updated_at": now,
                },
            )
        result = await session.execute(upsert_stmt.returning(self._revision_table.c.revision))
        revision = result.scalar_one()
        if revision is None:
            raise RuntimeError(self._revision_error_prefix())
        return str(int(revision))

    def _revision_insert(self, session: AsyncSession):
        bind = session.bind
        dialect_name = bind.dialect.name if bind is not None else ""
        if dialect_name == "sqlite":
            return sqlite_insert(self._revision_table)
        return pg_insert(self._revision_table)

    def _scope_predicate(self):
        if self._workspace_id is None:
            return (self._revision_table.c.table_id == self._table.table_id) & self._revision_table.c.workspace_id.is_(None)
        return (self._revision_table.c.table_id == self._table.table_id) & (
            self._revision_table.c.workspace_id == self._workspace_id
        )

    def _revision_error_prefix(self) -> str:
        return f"Failed to initialize revision row for {self._table.table_id}"
