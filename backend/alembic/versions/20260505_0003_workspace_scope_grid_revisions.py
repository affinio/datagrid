"""workspace scope grid revisions

Revision ID: 20260505_0003
Revises: 20260505_0002
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260505_0003"
down_revision: Union[str, None] = "20260505_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("grid_revisions", sa.Column("workspace_id", sa.String(), nullable=True))
    op.drop_constraint("grid_revisions_pkey", "grid_revisions", type_="primary")
    op.create_index(
        "uq_grid_revisions_default_scope",
        "grid_revisions",
        ["table_id"],
        unique=True,
        postgresql_where=sa.text("workspace_id IS NULL"),
        sqlite_where=sa.text("workspace_id IS NULL"),
    )
    op.create_index(
        "uq_grid_revisions_workspace_scope",
        "grid_revisions",
        ["table_id", "workspace_id"],
        unique=True,
        postgresql_where=sa.text("workspace_id IS NOT NULL"),
        sqlite_where=sa.text("workspace_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_grid_revisions_workspace_scope", table_name="grid_revisions")
    op.drop_index("uq_grid_revisions_default_scope", table_name="grid_revisions")
    op.create_primary_key("grid_revisions_pkey", "grid_revisions", ["table_id"])
    op.drop_column("grid_revisions", "workspace_id")
