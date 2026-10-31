"""Keep AI usage independently of deletable conversations."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c8a184f2d903"
down_revision = "b2e7c1a4f9d3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_ai_usage_user_created", "ai_usage_events", ["user_id", "created_at"]
    )
    op.execute("""
        INSERT INTO ai_usage_events (id, user_id, created_at)
        SELECT m.id, c.user_id, m.created_at
        FROM ai_messages m
        JOIN ai_conversations c ON c.id = m.conversation_id
        WHERE m.role = 'user'
          AND m.created_at >
              (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 hour'
    """)


def downgrade():
    op.drop_table("ai_usage_events")
