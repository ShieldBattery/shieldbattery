import { ChatMessage, ChatUser } from '../../common/chat'
import { BaseFetchFailure } from '../network/fetch-action-types'

export type ChatActions =
  | JoinChannelBegin
  | JoinChannel
  | JoinChannelFailure
  | LeaveChannelBegin
  | LeaveChannel
  | LeaveChannelFailure
  | SendMessageBegin
  | SendMessage
  | SendMessageFailure
  | LoadMessageHistoryBegin
  | LoadMessageHistory
  | LoadMessageHistoryFailure
  | RetrieveUserListBegin
  | RetrieveUserList
  | RetrieveUserListFailure
  | ActivateChannel
  | DeactivateChannel
  | InitChannel
  | UpdateJoin
  | UpdateLeave
  | UpdateLeaveSelf
  | UpdateMessage
  | UpdateUserActive
  | UpdateUserIdle
  | UpdateUserOffline

export interface JoinChannelBegin {
  type: '@chat/joinChannelBegin'
  payload: {
    channel: string
  }
}

/**
 * Makes the user join a channel. If a channel doesn't exist, it is created and user gets full
 * permissions in it.
 */
export interface JoinChannel {
  type: '@chat/joinChannel'
  payload: void
  meta: {
    channel: string
  }
  error?: false
}

export interface JoinChannelFailure extends BaseFetchFailure<'@chat/joinChannel'> {
  meta: {
    channel: string
  }
}

export interface LeaveChannelBegin {
  type: '@chat/leaveChannelBegin'
  payload: {
    channel: string
  }
}

/**
 * Makes the user leave a channel. If the user was the "owner" of the channel, a new "owner" will be
 * selected. If the user was the only member of the channel, the channel will be effectively reset.
 */
export interface LeaveChannel {
  type: '@chat/leaveChannel'
  payload: void
  meta: {
    channel: string
  }
  error?: false
}

export interface LeaveChannelFailure extends BaseFetchFailure<'@chat/leaveChannel'> {
  meta: {
    channel: string
  }
}

export interface SendMessageBegin {
  type: '@chat/sendMessageBegin'
  payload: {
    channel: string
    message: string
  }
}

/**
 * Send a chat message to a chat channel.
 */
export interface SendMessage {
  type: '@chat/sendMessage'
  payload: void
  meta: {
    channel: string
    message: string
  }
  error?: false
}

export interface SendMessageFailure extends BaseFetchFailure<'@chat/sendMessage'> {
  meta: {
    channel: string
    message: string
  }
}

export interface LoadMessageHistoryBegin {
  type: '@chat/loadMessageHistoryBegin'
  payload: {
    channel: string
    limit: number
    beforeTime: number
  }
}

/**
 * Loads the `limit` amount of messages in a chat channel before a particular time.
 */
export interface LoadMessageHistory {
  type: '@chat/loadMessageHistory'
  payload: ChatMessage[]
  meta: {
    channel: string
    limit: number
    beforeTime: number
  }
  error?: false
}

export interface LoadMessageHistoryFailure extends BaseFetchFailure<'@chat/loadMessageHistory'> {
  meta: {
    channel: string
    limit: number
    beforeTime: number
  }
}

export interface RetrieveUserListBegin {
  type: '@chat/retrieveUserListBegin'
  payload: {
    channel: string
  }
}

/**
 * Retrieve the full list of users in a particular channel.
 */
export interface RetrieveUserList {
  type: '@chat/retrieveUserList'
  payload: ChatUser[]
  meta: {
    channel: string
  }
  error?: false
}

export interface RetrieveUserListFailure extends BaseFetchFailure<'@chat/retrieveUserList'> {
  meta: {
    channel: string
  }
}

/**
 * Activate a particular chat channel. This is a purely client-side action which marks the channel
 * as "active", and removes the unread indicator if there is one.
 */
export interface ActivateChannel {
  type: '@chat/activateChannel'
  payload: {
    channel: string
  }
}

/**
 * Deactivate a particular chat channel. This is a purely client-side action which unloads the
 * message history of a channel and thus frees up some memory.
 */
export interface DeactivateChannel {
  type: '@chat/deactivateChannel'
  payload: {
    channel: string
  }
}

/**
 * We have joined a channel and the server has sent us some initial data.
 */
export interface InitChannel {
  type: '@chat/initChannel'
  payload: {
    channel: string
    activeUsers: ChatUser[]
  }
}

/**
 * A user has joined a channel we're in.
 */
export interface UpdateJoin {
  type: '@chat/updateJoin'
  payload: {
    channel: string
    user: ChatUser
  }
}

/**
 * A user has left a channel we're in.
 */
export interface UpdateLeave {
  type: '@chat/updateLeave'
  payload: {
    channel: string
    user: ChatUser
    newOwner: ChatUser | null
  }
}

/**
 * We have left a channel.
 */
export interface UpdateLeaveSelf {
  type: '@chat/updateLeaveSelf'
  payload: {
    channel: string
  }
}

/**
 * A channel we're in has receieved a new message.
 */
export interface UpdateMessage {
  type: '@chat/updateMessage'
  payload: {
    channel: string
    id: string
    time: number
    user: ChatUser
    message: string
  }
}

/**
 * A user in one of our chat channels has become active (non-idle and online).
 */
export interface UpdateUserActive {
  type: '@chat/updateUserActive'
  payload: {
    channel: string
    user: ChatUser
  }
}

/**
 * A user in one of our chat channels has become idle (still online, but not active).
 */
export interface UpdateUserIdle {
  type: '@chat/updateUserIdle'
  payload: {
    channel: string
    user: ChatUser
  }
}

/**
 * A user in one of our chat channels has gone offline
 */
export interface UpdateUserOffline {
  type: '@chat/updateUserOffline'
  payload: {
    channel: string
    user: ChatUser
  }
}
