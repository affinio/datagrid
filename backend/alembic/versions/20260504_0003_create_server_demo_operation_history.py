"""create server demo operation history tables

Revision ID: 20260504_0003
Revises: 20260504_0002
Create Date: 2026-05-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260504_0003"
down_revision: Union[str, None] = "20260504_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "server_demo_operations",
        sa.Column("operation_id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("operation_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("revision", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("operation_type in ('edit', 'fill')", name="ck_server_demo_operations_operation_type"),
        sa.CheckConstraint("status in ('applied', 'undone')", name="ck_server_demo_operations_status"),
    )
    op.create_index(
        "ix_server_demo_operations_operation_type",
        "server_demo_operations",
        ["operation_type"],
        unique=False,
    )
    op.create_index("ix_server_demo_operations_status", "server_demo_operations", ["status"], unique=False)
    op.create_index("ix_server_demo_operations_created_at", "server_demo_operations", ["created_at"], unique=False)

    op.create_table(
        "server_demo_cell_events",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "operation_id",
            sa.Text(),
            sa.ForeignKey("server_demo_operations.operation_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("row_id", sa.Text(), nullable=False),
        sa.Column("column_key", sa.Text(), nullable=False),
        sa.Column("before_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_server_demo_cell_events_operation_id",
        "server_demo_cell_events",
        ["operation_id"],
        unique=False,
    )
    op.create_index("ix_server_demo_cell_events_row_id", "server_demo_cell_events", ["row_id"], unique=False)
    op.create_index("ix_server_demo_cell_events_created_at", "server_demo_cell_events", ["created_at"], unique=False)

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO server_demo_operations (
                operation_id,
                operation_type,
                status,
                metadata,
                revision,
                created_at,
                modified_at
            )
            SELECT
                operation_id,
                'edit',
                CASE WHEN bool_and(applied) THEN 'applied' ELSE 'undone' END,
                '{}'::jsonb,
                COALESCE(max(revision), now()),
                COALESCE(min(created_at), now()),
                COALESCE(max(revision), max(created_at), now())
            FROM server_demo_row_events
            WHERE event_type = 'edit'
            GROUP BY operation_id
            """
        )
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO server_demo_cell_events (
                event_id,
                operation_id,
                row_id,
                column_key,
                before_value,
                after_value,
                created_at
            )
            SELECT
                event_id,
                operation_id,
                row_id,
                column_key,
                before_value,
                after_value,
                created_at
            FROM server_demo_row_events
            WHERE event_type = 'edit'
            """
        )
    )

    op.drop_index("ix_server_demo_row_events_created_at", table_name="server_demo_row_events")
    op.drop_index("ix_server_demo_row_events_row_id", table_name="server_demo_row_events")
    op.drop_index("ix_server_demo_row_events_operation_id", table_name="server_demo_row_events")
    op.drop_table("server_demo_row_events")


def downgrade() -> None:
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

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO server_demo_row_events (
                event_id,
                operation_id,
                event_type,
                row_id,
                column_key,
                before_value,
                after_value,
                applied,
                created_at,
                revision
            )
            SELECT
                cell.event_id,
                cell.operation_id,
                'edit',
                cell.row_id,
                cell.column_key,
                cell.before_value,
                cell.after_value,
                operation.status = 'applied',
                cell.created_at,
                operation.revision
            FROM server_demo_cell_events AS cell
            JOIN server_demo_operations AS operation
                ON operation.operation_id = cell.operation_id
            """
        )
    )

    op.drop_index("ix_server_demo_cell_events_created_at", table_name="server_demo_cell_events")
    op.drop_index("ix_server_demo_cell_events_row_id", table_name="server_demo_cell_events")
    op.drop_index("ix_server_demo_cell_events_operation_id", table_name="server_demo_cell_events")
    op.drop_table("server_demo_cell_events")
    op.drop_index("ix_server_demo_operations_created_at", table_name="server_demo_operations")
    op.drop_index("ix_server_demo_operations_status", table_name="server_demo_operations")
    op.drop_index("ix_server_demo_operations_operation_type", table_name="server_demo_operations")
    op.drop_table("server_demo_operations")
