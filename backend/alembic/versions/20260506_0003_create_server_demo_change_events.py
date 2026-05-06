"""create server demo change events

Revision ID: 20260506_0003
Revises: 20260506_0002_add_table_id_to_server_demo_operations
Create Date: 2026-05-06 00:03:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260506_0003"
down_revision = "20260506_0002_add_table_id_to_server_demo_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS server_demo_change_events_id_seq"))
    op.create_table(
        "server_demo_change_events",
        sa.Column(
            "id",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("nextval('server_demo_change_events_id_seq'::regclass)"),
        ),
        sa.Column("revision", sa.BigInteger(), nullable=False),
        sa.Column("workspace_id", sa.String(), nullable=True),
        sa.Column("table_id", sa.String(), nullable=False),
        sa.Column("operation_id", sa.Text(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("change_type", sa.Text(), nullable=False),
        sa.Column("invalidation", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="server_demo_change_events_pkey"),
    )
    op.execute(sa.text("ALTER SEQUENCE server_demo_change_events_id_seq OWNED BY server_demo_change_events.id"))
    op.create_index(
        "ix_server_demo_change_events_workspace_id_revision",
        "server_demo_change_events",
        ["workspace_id", "revision"],
        unique=False,
    )
    op.create_index(
        "ix_server_demo_change_events_created_at",
        "server_demo_change_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_server_demo_change_events_created_at", table_name="server_demo_change_events")
    op.drop_index("ix_server_demo_change_events_workspace_id_revision", table_name="server_demo_change_events")
    op.drop_table("server_demo_change_events")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS server_demo_change_events_id_seq"))
