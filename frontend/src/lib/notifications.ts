import type { AppNotification } from './types'

// Human wording for a notification row. Vote text stays neutral (we never reveal
// direction). Lane C's bell/inbox use this.
export function describeNotification(n: AppNotification): string {
  const who = n.actor?.username ?? 'Someone'
  const subject = n.subject_type ?? 'post'
  switch (n.event_type) {
    case 'answer_created':
      return `${who} answered your question`
    case 'comment_created':
      return `${who} commented on your post`
    case 'vote_cast':
      return `${who} voted on your ${subject}`
    case 'mentioned':
      return `${who} mentioned you in a ${subject}`
    case 'friend_request':
      return `${who} sent you a friend request`
    case 'friend_accepted':
      return `${who} accepted your friend request`
    default:
      return `${who}: ${n.event_type.replace(/_/g, ' ')}`
  }
}
