"""add rows to server demo change events

Revision ID: 20260506_0004
Revises: 20260506_0003
Create Date: 2026-05-06 00:04:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260506_0004"
down_revision = "20260506_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("server_demo_change_events")}
    if "rows" not in columns:
        op.add_column(
            "server_demo_change_events",
            sa.Column("rows", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE server_demo_change_events DROP COLUMN IF EXISTS rows"))
