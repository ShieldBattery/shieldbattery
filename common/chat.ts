export interface ChatMessage {
  id: string
  user: string
  sent: number
  data: {
    type: string
    text: string
  }
}

// TODO(2Pac): Make this into an interface and include more information here
export type ChatUser = string

export interface ChatInitEvent {
  action: 'init'
  activeUsers: string[]
}

export interface ChatJoinEvent {
  action: 'join'
  user: string
}

export interface ChatLeaveEvent {
  action: 'leave'
  user: string
  newOwner: string | null
}

export interface ChatMessageEvent extends ChatMessage {
  action: 'message'
}

export interface ChatUserActiveEvent {
  action: 'userActive'
  user: string
}

export interface ChatUserIdleEvent {
  action: 'userIdle'
  user: string
}

export interface ChatUserOfflineEvent {
  action: 'userOffline'
  user: string
}

export type ChatEvent =
  | ChatInitEvent
  | ChatJoinEvent
  | ChatLeaveEvent
  | ChatMessageEvent
  | ChatUserActiveEvent
  | ChatUserIdleEvent
  | ChatUserOfflineEvent

export interface SendChatMessageServerBody {
  message: string
}
