"""create server demo row events table

Revision ID: 20260504_0002
Revises: 20260504_0001
Create Date: 2026-05-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260504_0002"
down_revision: Union[str, None] = "20260504_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "server_demo_row_events",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("operation_id", sa.Text(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column(
            "row_id",
            sa.String(),
            sa.ForeignKey("grid_demo_rows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("column_key", sa.String(), nullable=False),
        sa.Column("before_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("applied", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revision", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("event_type in ('edit', 'undo', 'redo')", name="ck_server_demo_row_events_event_type"),
    )
    op.create_index(
        "ix_server_demo_row_events_operation_id",
        "server_demo_row_events",
        ["operation_id"],
        unique=False,
    )
    op.create_index("ix_server_demo_row_events_row_id", "server_demo_row_events", ["row_id"], unique=False)
    op.create_index(
        "ix_server_demo_row_events_created_at",
        "server_demo_row_events",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_server_demo_row_events_created_at", table_name="server_demo_row_events")
    op.drop_index("ix_server_demo_row_events_row_id", table_name="server_demo_row_events")
    op.drop_index("ix_server_demo_row_events_operation_id", table_name="server_demo_row_events")
    op.drop_table("server_demo_row_events")
