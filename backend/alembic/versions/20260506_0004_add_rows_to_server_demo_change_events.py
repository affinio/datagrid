"""add rows to server demo change events

Revision ID: 20260506_0004
Revises: 20260506_0003_create_server_demo_change_events
Create Date: 2026-05-06 00:04:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260506_0004"
down_revision = "20260506_0003_create_server_demo_change_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "server_demo_change_events",
        sa.Column("rows", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("server_demo_change_events", "rows")
