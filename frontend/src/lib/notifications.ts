import type { AppNotification } from './types'

export function describeNotification(notification: AppNotification): string {
  const who = notification.actor?.username ?? 'Someone'
  const subject = notification.subject_type ?? 'post'

  switch (notification.event_type) {
    case 'answer_created':
      return `${who} answered your question`

    case 'comment_created':
      return `${who} commented on your post`

    case 'vote_cast':
      if (notification.actor_count > 1) {
        const others = notification.actor_count - 1
        return `${who} and ${others} others voted on your ${subject}`
      }

      return `${who} voted on your ${subject}`

    case 'content_edited':
      return `${who} edited their ${subject} on your question`

    case 'content_deleted':
      return `${who} deleted their ${subject} on your question`

    case 'mentioned':
      return `${who} mentioned you in a ${subject}`

    case 'friend_request':
      return `${who} sent you a friend request`

    case 'friend_accepted':
      return `${who} accepted your friend request`

    case 'friend_removed':
      return `${who} removed you as a friend`

    case 'moderation_pending':
      return `Your ${subject} is being held for review`

    case 'moderation_approved':
      return `Your ${subject} was approved and is now public`

    case 'moderation_rejected':
      return `Your ${subject} was rejected by a moderator`

    default:
      return `${who} triggered a notification`
  }
}