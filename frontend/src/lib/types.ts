// Shared API types mirroring the backend Pydantic schemas.

export type User = {
  id: string
  email: string | null
  username: string
  bio: string | null
  avatar_url: string | null
  role: string
  created_at: string
  is_anonymized: boolean
  has_password: boolean
}

export type Author = {
  id: string
  username: string
  avatar_url: string | null
  is_anonymized: boolean
}

export type ParentType = 'question' | 'answer'

export type Comment = {
  id: string
  parent_type: ParentType
  parent_id: string
  body: string
  author: Author
  moderation_status: string
  moderation_note: string | null
  created_at: string
  updated_at: string
}

export type Answer = {
  id: string
  body: string
  author: Author
  is_ai_assisted: boolean
  vote_total: number
  my_vote: number
  moderation_status: string
  moderation_note: string | null
  created_at: string
  updated_at: string
  comments: Comment[]
  attachments: Attachment[]
}

export type Question = {
  id: string
  title: string
  body: string
  tags: string[]
  author: Author
  view_count: number
  vote_total: number
  my_vote: number
  accepted_answer_id: string | null
  moderation_status: string
  moderation_note: string | null
  created_at: string
  updated_at: string
  answers: Answer[]
  comments: Comment[]
  attachments: Attachment[]
}

export type QuestionListItem = {
  id: string
  title: string
  excerpt: string
  tags: string[]
  author: Author
  vote_total: number
  answer_count: number
  view_count: number
  has_accepted_answer: boolean
  created_at: string
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export type VoteResult = {
  vote_total: number
  my_vote: number
}

// ── Phase 2: identity & social ────────────────────────────────────────────────

export type FriendshipState =
  | 'none'
  | 'request_sent'
  | 'incoming_pending'
  | 'friends'
  | 'rejected'

export type FriendshipInfo = {
  state: FriendshipState
  id: string | null
}

export type UserProfile = {
  id: string
  username: string
  bio: string | null
  avatar_url: string | null
  created_at: string
  question_count: number
  answer_count: number
  accepted_answer_count: number
  is_anonymized: boolean
  friendship: FriendshipInfo | null
}

export type AnswerListItem = {
  id: string
  question_id: string
  question_title: string
  excerpt: string
  vote_total: number
  is_accepted: boolean
  created_at: string
}

export type Friend = {
  friendship_id: string
  user: Author
  online: boolean
  last_seen: string
  since: string
}

export type PendingRequest = {
  friendship_id: string
  requester: Author
  created_at: string
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  body: string
  read_at: string | null
  created_at: string
}

export type Conversation = {
  user: Author
  last_message: string
  last_message_at: string
  last_message_from_me: boolean
  unread_count: number
}

// ── Phase 3: notifications ────────────────────────────────────────────────────

// Named AppNotification (not Notification) to avoid silently shadowing the
// browser's global Notification type when an import is forgotten.
export type AppNotification = {
  id: string
  event_type: string
  subject_type: string | null
  subject_id: string | null
  link: string
  actor: Author | null
  actor_count: number
  read_at: string | null
  created_at: string
}

export type UnreadCount = {
  count: number
}

// ── Phase 4: AI assistant & moderation ────────────────────────────────────────

export type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type AiConversation = {
  id: string
  title: string | null
  question: { id: string; title: string } | null
  created_at: string
  updated_at: string
}

export type AiConversationDetail = AiConversation & {
  messages: AiChatMessage[]
}

export type PendingModerationItem = {
  type: 'question' | 'answer' | 'comment'
  id: string
  title: string | null
  body: string
  author: Author
  moderation_note: string | null
  question_id: string | null
  created_at: string
}

// ── Phase 5: search & files ───────────────────────────────────────────────────

export type SearchResult = {
  id: string
  title: string
  // Contains <mark>…</mark> markers when a query was given; rendered by
  // splitting on the markers, never as raw HTML.
  highlight: string
  tags: string[]
  author: Author
  vote_total: number
  answer_count: number
  view_count: number
  has_accepted_answer: boolean
  created_at: string
}

export type Attachment = {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  url: string
  parent_type: ParentType | null
  parent_id: string | null
  created_at: string
}
