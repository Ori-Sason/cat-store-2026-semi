import type { ChatMsg } from '@cat-store/shared'
import type { PendingChatMsg } from '../../../models/chat'

// idle: not opened yet. loading: the first page is on its way. error: the join or that fetch failed
export type CatChatStatus = 'idle' | 'loading' | 'ready' | 'error'

// A saved msg waiting on its edit or remove ack
export type ChatMsgBusyAction = 'updating' | 'removing'

export interface CatChatState {
  catId: string
  msgs: ChatMsg[] // by _id, oldest first
  pendingMsgs: PendingChatMsg[] // own sends not confirmed yet, in send order, below the msgs
  status: CatChatStatus
  isOldestLoaded: boolean // the server said nothing older exists
  isLoadingOlder: boolean
  unreadCount: number // msgs from others since the panel was last open
  busyMsgs: Partial<Record<string, ChatMsgBusyAction>> // by _id
}

// The server event payloads for chat:msg-added / updated / removed, and the acks of
// chat:msg-add / update / remove
export interface ChatMsgEvent {
  msg: ChatMsg
}

export function getInitialChatState(catId: string): CatChatState {
  return {
    catId,
    msgs: [],
    pendingMsgs: [],
    status: 'idle',
    isOldestLoaded: false,
    isLoadingOlder: false,
    unreadCount: 0,
    busyMsgs: {},
  }
}
