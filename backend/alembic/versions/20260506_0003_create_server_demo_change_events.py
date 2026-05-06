"""create server demo change events

Revision ID: 20260506_0003
Revises: 20260506_0002
Create Date: 2026-05-06 00:03:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260506_0003"
down_revision = "20260506_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS server_demo_change_events_id_seq"))
    if not inspector.has_table("server_demo_change_events"):
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
    op.execute(sa.text("ALTER SEQUENCE IF EXISTS server_demo_change_events_id_seq OWNED BY server_demo_change_events.id"))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_server_demo_change_events_workspace_id_revision "
        "ON server_demo_change_events (workspace_id, revision)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_server_demo_change_events_created_at "
        "ON server_demo_change_events (created_at)"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_server_demo_change_events_created_at"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_server_demo_change_events_workspace_id_revision"))
    op.execute(sa.text("DROP TABLE IF EXISTS server_demo_change_events"))
    op.execute(sa.text("DROP SEQUENCE IF EXISTS server_demo_change_events_id_seq"))
