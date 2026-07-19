"""add messages receiver/read index

Serves receiver-side message reads (unread counts and the receiver branch of the
conversation list) that the sender-leading ix_messages_sender_receiver_created
index cannot satisfy.

Revision ID: b2e7c1a4f9d3
Revises: 0703de912a0b
Create Date: 2026-06-09 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2e7c1a4f9d3'
down_revision: Union[str, None] = '0703de912a0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_messages_receiver_read',
        'messages',
        ['receiver_id', 'read_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_messages_receiver_read', table_name='messages')
