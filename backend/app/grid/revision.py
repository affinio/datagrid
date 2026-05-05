from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.grid.table import GridTableDefinition


class GridRevisionService:
    def __init__(self, table: GridTableDefinition):
        self._table = table

    async def get_revision(self, session: AsyncSession) -> str:
        column = getattr(self._table.model, self._table.updated_at_attr)
        revision = await session.scalar(select(func.max(column)).select_from(self._table.model))
        if revision is None:
            return "empty"
        return revision.isoformat()
