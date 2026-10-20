import type {
  ChatMsgWithRefs,
  ChatMsgNewerPage,
  ChatMsgOlderPage,
  LoggedInUser,
} from '@cat-store/shared'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, vi } from 'vitest'
import { chatService } from '../../../services/chat.service'
import { socketService } from '../../../services/socket.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { useUserMsgStore } from '../../../store/user-msg.store'
import { useCatChat } from './use-cat-chat'

// Shared by the useCatChat test files. Each file still mocks socketService, chatService and
// react-router itself: vi.mock is hoisted only within the file that calls it

export const CAT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
export const OTHER_CAT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'

// The author of makeMsg's msgs
export const VIEWER: LoggedInUser = {
  _id: 'user-1',
  username: 'maya',
  fullname: 'Maya Levi',
  isAdmin: false,
}

// The socket's listeners, so a test can play the server: on / off of the mocked socketService
// feed this map, and serverEmit calls whatever is still listening
export const socketListeners = new Map<string, Set<(payload: unknown) => void>>()

// Resets the mocks and the stores before each test, joins ack with {}, the socket is connected,
// and wires the socket fake.
// Call it at the top level of the file
export function setupChatTest() {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState(useUserMsgStore.getInitialState())
    useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
    vi.mocked(socketService.emitWithAck).mockResolvedValue({})
    vi.mocked(socketService.isConnected).mockReturnValue(true)
    _listenToSocket()
  })
}

// ObjectId-like ids, so the hook's _id order matches n
export function makeMsgId(n: number) {
  return n.toString(16).padStart(24, '0')
}

export function makeMsg(n: number, catId = CAT_ID): ChatMsgWithRefs {
  return {
    _id: makeMsgId(n),
    catId,
    clientMsgId: `client-${n}`,
    createdAt: n,
    updatedAt: n,
    user: { _id: VIEWER._id, fullname: VIEWER.fullname, isAdmin: false },
    isDeleted: false,
    text: `msg ${n}`,
  }
}

// Built field by field: the wire tombstone has no text. A remove sets only isDeleted: updatedAt
// stays
export function makeTombstone(n: number): ChatMsgWithRefs {
  const { _id, catId, clientMsgId, createdAt, updatedAt, user } = makeMsg(n)
  return { _id, catId, clientMsgId, createdAt, updatedAt, user, isDeleted: true }
}

export function makePage(ns: number[], nextBeforeId: string | null): ChatMsgOlderPage {
  return { msgs: ns.map((n) => makeMsg(n)), nextBeforeId }
}

export function makeNewerPage(ns: number[], nextAfterId: string | null): ChatMsgNewerPage {
  return { msgs: ns.map((n) => makeMsg(n)), nextAfterId }
}

export function idsOf(msgs: ChatMsgWithRefs[]) {
  return msgs.map((msg) => msg._id)
}

// Promise.withResolvers, which the FE's ES2023 lib doesn't type: holds a call mid-flight
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

export function serverEmit(event: string, payload?: unknown) {
  for (const listener of socketListeners.get(event) ?? []) listener(payload)
}

export function joinCalls() {
  return vi.mocked(socketService.emitWithAck).mock.calls.filter(([event]) => event === 'chat:join')
}

export function renderChat(catId = CAT_ID, isOpen = false) {
  return renderHook((props) => useCatChat(props.catId, props.isOpen, props.isCatDeleting), {
    initialProps: { catId, isOpen, isCatDeleting: false },
  })
}

// Renders an open chat whose first page has loaded
export async function renderReadyChat(ns: number[], nextBeforeId: string | null = null) {
  vi.mocked(chatService.getOlderPage).mockResolvedValueOnce(makePage(ns, nextBeforeId))
  const rendered = renderChat(CAT_ID, true)
  await waitFor(() => expect(rendered.result.current.status).toBe('ready'))
  return rendered
}

function _listenToSocket() {
  socketListeners.clear()
  vi.mocked(socketService.on).mockImplementation((event, listener) => {
    if (!socketListeners.has(event)) socketListeners.set(event, new Set())
    socketListeners.get(event)!.add(listener as (payload: unknown) => void)
  })
  vi.mocked(socketService.off).mockImplementation((event, listener) => {
    socketListeners.get(event)?.delete(listener as (payload: unknown) => void)
  })
}
