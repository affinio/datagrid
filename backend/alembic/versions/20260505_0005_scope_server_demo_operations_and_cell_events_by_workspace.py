"""scope server demo operations and cell events by workspace

Revision ID: 20260505_0005
Revises: 20260505_0004
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260505_0005"
down_revision: Union[str, None] = "20260505_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS server_demo_operations_id_seq"))
    op.add_column(
        "server_demo_operations",
        sa.Column(
            "id",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("nextval('server_demo_operations_id_seq'::regclass)"),
        ),
    )
    op.execute(sa.text("ALTER SEQUENCE server_demo_operations_id_seq OWNED BY server_demo_operations.id"))
    op.drop_constraint("server_demo_cell_events_operation_id_fkey", "server_demo_cell_events", type_="foreignkey")
    op.add_column("server_demo_operations", sa.Column("workspace_id", sa.String(), nullable=True))
    op.add_column("server_demo_cell_events", sa.Column("workspace_id", sa.String(), nullable=True))
    op.drop_constraint("server_demo_operations_pkey", "server_demo_operations", type_="primary")
    op.create_primary_key("server_demo_operations_pkey", "server_demo_operations", ["id"])
    op.create_index(
        "ix_server_demo_operations_operation_id_workspace_id",
        "server_demo_operations",
        ["operation_id", "workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_server_demo_cell_events_operation_id_workspace_id",
        "server_demo_cell_events",
        ["operation_id", "workspace_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_server_demo_cell_events_operation_id_workspace_id", table_name="server_demo_cell_events")
    op.drop_index("ix_server_demo_operations_operation_id_workspace_id", table_name="server_demo_operations")
    op.drop_constraint("server_demo_operations_pkey", "server_demo_operations", type_="primary")
    op.create_primary_key("server_demo_operations_pkey", "server_demo_operations", ["operation_id"])
    op.drop_column("server_demo_cell_events", "workspace_id")
    op.drop_column("server_demo_operations", "workspace_id")
    op.create_foreign_key(
        "server_demo_cell_events_operation_id_fkey",
        "server_demo_cell_events",
        "server_demo_operations",
        ["operation_id"],
        ["operation_id"],
        ondelete="CASCADE",
    )
    op.drop_column("server_demo_operations", "id")
    op.execute(sa.text("DROP SEQUENCE IF EXISTS server_demo_operations_id_seq"))
