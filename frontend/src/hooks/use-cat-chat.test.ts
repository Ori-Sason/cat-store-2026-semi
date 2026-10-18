import type {
  ChatMsg,
  ChatMsgInput,
  ChatMsgNewerPage,
  ChatMsgOlderPage,
  LoggedInUser,
} from '@cat-store/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { chatService } from '../services/chat.service'
import { socketService } from '../services/socket.service'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { useUserMsgStore } from '../store/user-msg.store'
import { useCatChat } from './use-cat-chat/use-cat-chat'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../services/socket.service')
vi.mock('../services/chat.service')
// Only the redirect is checked here, so a stand-in navigate is enough. The hook needs no router
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))

const _CAT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const _OTHER_CAT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb'

// ObjectId-like ids, so the hook's _id order matches n
function _msgId(n: number) {
  return n.toString(16).padStart(24, '0')
}

function _msg(n: number, catId = _CAT_ID): ChatMsg {
  return {
    _id: _msgId(n),
    catId,
    clientMsgId: `client-${n}`,
    createdAt: n,
    updatedAt: n,
    user: { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false },
    isDeleted: false,
    text: `msg ${n}`,
  }
}

function _page(ns: number[], nextBeforeId: string | null): ChatMsgOlderPage {
  return { msgs: ns.map((n) => _msg(n)), nextBeforeId }
}

function _render(catId = _CAT_ID, isOpen = false) {
  return renderHook((props) => useCatChat(props.catId, props.isOpen), {
    initialProps: { catId, isOpen },
  })
}

// Promise.withResolvers, which the FE's ES2023 lib doesn't type: holds a call mid-flight
function _deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => (resolve = res))
  return { promise, resolve }
}

function _ids(msgs: ChatMsg[]) {
  return msgs.map((msg) => msg._id)
}

// The socket's listeners, so a test can play the server: on / off of the mocked socketService
// feed this map, and _serverEmit calls whatever is still listening
const listeners = new Map<string, Set<(payload: unknown) => void>>()

function _serverEmit(event: string, payload?: unknown) {
  for (const listener of listeners.get(event) ?? []) listener(payload)
}

function _listenToSocket() {
  listeners.clear()
  vi.mocked(socketService.on).mockImplementation((event, listener) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(listener as (payload: unknown) => void)
  })
  vi.mocked(socketService.off).mockImplementation((event, listener) => {
    listeners.get(event)?.delete(listener as (payload: unknown) => void)
  })
}

function _newerPage(ns: number[], nextAfterId: string | null): ChatMsgNewerPage {
  return { msgs: ns.map((n) => _msg(n)), nextAfterId }
}

function _joinCalls() {
  return vi.mocked(socketService.emitWithAck).mock.calls.filter(([event]) => event === 'chat:join')
}

// Renders an open chat whose first page has loaded
async function _renderReady(ns: number[], nextBeforeId: string | null = null) {
  vi.mocked(chatService.getOlderPage).mockResolvedValueOnce(_page(ns, nextBeforeId))
  const rendered = _render(_CAT_ID, true)
  await waitFor(() => expect(rendered.result.current.status).toBe('ready'))
  return rendered
}

beforeEach(() => {
  vi.resetAllMocks()
  useUserMsgStore.setState(useUserMsgStore.getInitialState())
  useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
  vi.mocked(socketService.emitWithAck).mockResolvedValue({})
  _listenToSocket()
})

describe('useCatChat history', () => {
  describe('join and leave', () => {
    it('joins the room on mount and leaves it on unmount', () => {
      const { unmount } = _render()

      expect(socketService.emitWithAck).toHaveBeenCalledExactlyOnceWith('chat:join', {
        catId: _CAT_ID,
      })

      unmount()

      expect(socketService.emit).toHaveBeenCalledExactlyOnceWith('chat:leave', { catId: _CAT_ID })
    })

    it('joins with a lowercased catId', () => {
      _render(_CAT_ID.toUpperCase())

      expect(socketService.emitWithAck).toHaveBeenCalledWith('chat:join', { catId: _CAT_ID })
    })

    // Dev mode runs mount effects twice: join → leave → join, and the room stays joined
    it('ends joined under StrictMode, and the first open fetches once', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
      const { result, rerender } = renderHook((props) => useCatChat(props.catId, props.isOpen), {
        initialProps: { catId: _CAT_ID, isOpen: false },
        wrapper: StrictMode,
      })

      expect(vi.mocked(socketService.emitWithAck).mock.calls.map(([event]) => event)).toEqual([
        'chat:join',
        'chat:join',
      ])
      expect(socketService.emit).toHaveBeenCalledExactlyOnceWith('chat:leave', { catId: _CAT_ID })

      rerender({ catId: _CAT_ID, isOpen: true })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(chatService.getOlderPage).toHaveBeenCalledOnce()
    })

    it('does not fetch while the chat is closed', () => {
      const { result } = _render()

      expect(chatService.getOlderPage).not.toHaveBeenCalled()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('the first open', () => {
    it('waits for the join ack, then fetches the newest page', async () => {
      const join = _deferred<object>()
      vi.mocked(socketService.emitWithAck).mockReturnValue(join.promise)
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1, 2], null))
      const { result, rerender } = _render()

      rerender({ catId: _CAT_ID, isOpen: true })
      await act(() => Promise.resolve())
      expect(result.current.status).toBe('loading')
      expect(chatService.getOlderPage).not.toHaveBeenCalled()

      await act(async () => join.resolve({}))

      expect(chatService.getOlderPage).toHaveBeenCalledExactlyOnceWith(_CAT_ID)
      expect(result.current.status).toBe('ready')
      expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
    })

    it('fetches once: closing and reopening keeps the msgs', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
      const { result, rerender } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.status).toBe('ready'))

      rerender({ catId: _CAT_ID, isOpen: false })
      rerender({ catId: _CAT_ID, isOpen: true })

      expect(chatService.getOlderPage).toHaveBeenCalledOnce()
      expect(_ids(result.current.msgs)).toEqual([_msgId(1)])
    })

    it('shows the error state when the join fails', async () => {
      vi.mocked(socketService.emitWithAck).mockRejectedValue(
        new ApiError(0, 'NETWORK_ERROR', 'timeout'),
      )

      const { result } = _render(_CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('error'))
      expect(chatService.getOlderPage).not.toHaveBeenCalled()
    })

    it('shows the error state when the fetch fails', async () => {
      vi.mocked(chatService.getOlderPage).mockRejectedValue(
        new ApiError(0, 'NETWORK_ERROR', 'down'),
      )

      const { result } = _render(_CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('error'))
    })
  })

  describe('load older', () => {
    it('offers older msgs while the server has more', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([5, 6], _msgId(5)))

      const { result } = _render(_CAT_ID, true)

      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))
    })

    it('offers nothing older when the first page is the whole log', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([5, 6], null))

      const { result } = _render(_CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.isOlderAvailable).toBe(false)
    })

    it('fetches before the oldest held msg and keeps the list in _id order', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(_page([5, 6], _msgId(5)))
        .mockResolvedValueOnce(_page([3, 4], null))
      const { result } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(chatService.getOlderPage).toHaveBeenLastCalledWith(_CAT_ID, _msgId(5))
      expect(_ids(result.current.msgs)).toEqual([3, 4, 5, 6].map(_msgId))
      expect(result.current.isOlderAvailable).toBe(false)
    })

    it('dedupes a msg that is already held', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(_page([5, 6], _msgId(5)))
        .mockResolvedValueOnce(_page([4, 5], _msgId(4)))
      const { result } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(_ids(result.current.msgs)).toEqual([4, 5, 6].map(_msgId))
    })

    it('shows a user msg on a failure and still offers older msgs', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(_page([5, 6], _msgId(5)))
        .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'down'))
      const { result } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(useUserMsgStore.getState().msg?.type).toBe('error')
      expect(result.current.isOlderAvailable).toBe(true)
      expect(result.current.isLoadingOlder).toBe(false)
    })
  })

  describe('a cat switch', () => {
    it('leaves the old room, joins the new one and resets the state', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
      const { result, rerender } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.status).toBe('ready'))

      rerender({ catId: _OTHER_CAT_ID, isOpen: false })

      expect(socketService.emit).toHaveBeenCalledWith('chat:leave', { catId: _CAT_ID })
      expect(socketService.emitWithAck).toHaveBeenLastCalledWith('chat:join', {
        catId: _OTHER_CAT_ID,
      })
      expect(result.current.status).toBe('idle')
      expect(result.current.msgs).toEqual([])
    })

    it("drops the old cat's fetch when it lands after the switch", async () => {
      const oldFetch = _deferred<ChatMsgOlderPage>()
      vi.mocked(chatService.getOlderPage).mockReturnValueOnce(oldFetch.promise)
      const { result, rerender } = _render(_CAT_ID, true)
      await waitFor(() => expect(chatService.getOlderPage).toHaveBeenCalledOnce())

      rerender({ catId: _OTHER_CAT_ID, isOpen: false })
      await act(async () => oldFetch.resolve(_page([1], null)))

      expect(result.current.msgs).toEqual([])
      expect(result.current.status).toBe('idle')
    })

    it('fetches the new cat on open', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(_page([1], null))
        .mockResolvedValueOnce({ msgs: [_msg(9, _OTHER_CAT_ID)], nextBeforeId: null })
      const { result, rerender } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.status).toBe('ready'))

      rerender({ catId: _OTHER_CAT_ID, isOpen: true })

      await waitFor(() => expect(_ids(result.current.msgs)).toEqual([_msgId(9)]))
      expect(chatService.getOlderPage).toHaveBeenLastCalledWith(_OTHER_CAT_ID)
    })
  })
})

describe('useCatChat live msgs', () => {
  it('inserts a msg-added event in _id order', async () => {
    const { result } = await _renderReady([1, 3])

    act(() => _serverEmit('chat:msg-added', { msg: _msg(2) }))

    expect(_ids(result.current.msgs)).toEqual([1, 2, 3].map(_msgId))
  })

  it('dedupes an event for a msg the first page already holds', async () => {
    const { result } = await _renderReady([1, 2])

    act(() => _serverEmit('chat:msg-added', { msg: _msg(2) }))

    expect(_ids(result.current.msgs)).toEqual([1, 2].map(_msgId))
  })

  // Joined on mount, fetched on open: a msg sent in between arrives live and isn't lost
  it('merges the events since the join with the first page', async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1, 2], null))
    const { result, rerender } = _render()

    act(() => _serverEmit('chat:msg-added', { msg: _msg(3) }))
    rerender({ catId: _CAT_ID, isOpen: true })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(_ids(result.current.msgs)).toEqual([1, 2, 3].map(_msgId))
  })

  it('drops an event for another cat', async () => {
    const { result } = await _renderReady([1])

    act(() => _serverEmit('chat:msg-added', { msg: _msg(2, _OTHER_CAT_ID) }))

    expect(_ids(result.current.msgs)).toEqual([_msgId(1)])
  })

  it('keeps events for the cat when the route param is uppercase', async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
    const { result } = _render(_CAT_ID.toUpperCase(), true)
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => _serverEmit('chat:msg-added', { msg: _msg(2) }))

    expect(_ids(result.current.msgs)).toEqual([1, 2].map(_msgId))
  })

  it('stops listening to the old cat after a switch', async () => {
    const { result, rerender } = await _renderReady([1])

    rerender({ catId: _OTHER_CAT_ID, isOpen: false })
    act(() => _serverEmit('chat:msg-added', { msg: _msg(2) }))

    expect(result.current.msgs).toEqual([])
    expect(listeners.get('chat:msg-added')?.size).toBe(1)
  })

  it('removes its listeners on unmount', () => {
    const { unmount } = _render()

    unmount()

    expect(listeners.get('chat:msg-added')?.size).toBe(0)
    expect(listeners.get('connect')?.size).toBe(0)
  })
})

// The race: the chat is closed, so a live copy lands first, then the first open's fetch brings a
// copy it read earlier or later. The content decides, not the arrival order
describe('useCatChat merge of two copies of one msg', () => {
  async function _openAfterLiveCopy(liveMsg: ChatMsg, fetchedMsg: ChatMsg) {
    vi.mocked(chatService.getOlderPage).mockResolvedValue({
      msgs: [fetchedMsg],
      nextBeforeId: null,
    })
    const { result, rerender } = _render()
    act(() => _serverEmit('chat:msg-added', { msg: liveMsg }))
    rerender({ catId: _CAT_ID, isOpen: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    return result.current.msgs
  }

  const _edited: ChatMsg = { ..._msg(1), isDeleted: false, updatedAt: 100, text: 'edited' }
  // Built field by field: the wire tombstone has no text
  const { _id, catId, clientMsgId, createdAt, updatedAt, user } = _msg(1)
  const _tombstone: ChatMsg = {
    _id,
    catId,
    clientMsgId,
    createdAt,
    updatedAt,
    user,
    isDeleted: true,
  }

  it('keeps an edit when a stale copy lands after it', async () => {
    expect(await _openAfterLiveCopy(_edited, _msg(1))).toEqual([_edited])
  })

  it('takes a copy with a later updatedAt', async () => {
    expect(await _openAfterLiveCopy(_msg(1), _edited)).toEqual([_edited])
  })

  // A remove doesn't touch updatedAt, so the tombstone can't win by the timestamp
  it('takes a tombstone over a live copy with the same updatedAt', async () => {
    expect(await _openAfterLiveCopy(_msg(1), _tombstone)).toEqual([_tombstone])
  })

  it('never brings a deleted msg back', async () => {
    expect(await _openAfterLiveCopy(_tombstone, _edited)).toEqual([_tombstone])
  })
})

describe('useCatChat unread count', () => {
  it("counts others' msgs while the panel is closed", () => {
    const { result } = _render()

    act(() => {
      _serverEmit('chat:msg-added', { msg: _msg(1) })
      _serverEmit('chat:msg-added', { msg: _msg(2) })
    })

    expect(result.current.unreadCount).toBe(2)
  })

  it("doesn't count the viewer's own msgs", () => {
    useLoggedInUserStore.setState({
      loggedInUser: { _id: 'user-1', username: 'maya', fullname: 'Maya Levi', isAdmin: false },
    })
    const { result } = _render()

    act(() => _serverEmit('chat:msg-added', { msg: _msg(1) }))

    expect(result.current.unreadCount).toBe(0)
  })

  it('counts a msg whose author is gone', () => {
    const { result } = _render()

    act(() => _serverEmit('chat:msg-added', { msg: { ..._msg(1), user: null } }))

    expect(result.current.unreadCount).toBe(1)
  })

  it("resets on open, doesn't count while open, and starts over after a close", async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([], null))
    const { result, rerender } = _render()
    act(() => _serverEmit('chat:msg-added', { msg: _msg(1) }))

    rerender({ catId: _CAT_ID, isOpen: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => _serverEmit('chat:msg-added', { msg: _msg(2) }))
    expect(result.current.unreadCount).toBe(0)

    rerender({ catId: _CAT_ID, isOpen: false })
    expect(result.current.unreadCount).toBe(0)
    act(() => _serverEmit('chat:msg-added', { msg: _msg(3) }))
    expect(result.current.unreadCount).toBe(1)
  })
})

describe('useCatChat reconnect', () => {
  it('rejoins the room on every connect', () => {
    _render()

    act(() => _serverEmit('connect'))
    act(() => _serverEmit('connect'))

    expect(_joinCalls()).toHaveLength(3)
    expect(_joinCalls().at(-1)).toEqual(['chat:join', { catId: _CAT_ID }])
  })

  it('only rejoins a chat that was never opened: the first open fetches', () => {
    _render()

    act(() => _serverEmit('connect'))

    expect(chatService.getOlderPage).not.toHaveBeenCalled()
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it('fills the gap after the rejoin ack, page by page', async () => {
    const { result } = await _renderReady([1, 2])
    const rejoin = _deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(rejoin.promise)
    vi.mocked(chatService.getNewerPage)
      .mockResolvedValueOnce(_newerPage([3, 4], _msgId(4)))
      .mockResolvedValueOnce(_newerPage([5], null))

    act(() => _serverEmit('connect'))
    await act(() => Promise.resolve())
    expect(chatService.getNewerPage).not.toHaveBeenCalled()

    await act(async () => rejoin.resolve({}))

    await waitFor(() => expect(_ids(result.current.msgs)).toEqual([1, 2, 3, 4, 5].map(_msgId)))
    expect(vi.mocked(chatService.getNewerPage).mock.calls).toEqual([
      [_CAT_ID, _msgId(2)],
      [_CAT_ID, _msgId(4)],
    ])
  })

  // A live msg that lands after the rejoin is newer than the gap, so it can't be the cursor
  it('fills from the newest msg held before the drop', async () => {
    const { result } = await _renderReady([1, 2])
    const rejoin = _deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(rejoin.promise)
    vi.mocked(chatService.getNewerPage).mockResolvedValue(_newerPage([3, 4], null))

    act(() => _serverEmit('connect'))
    act(() => _serverEmit('chat:msg-added', { msg: _msg(4) }))
    await act(async () => rejoin.resolve({}))

    await waitFor(() => expect(_ids(result.current.msgs)).toEqual([1, 2, 3, 4].map(_msgId)))
    expect(chatService.getNewerPage).toHaveBeenCalledExactlyOnceWith(_CAT_ID, _msgId(2))
  })

  it('refetches the newest page when the log was empty', async () => {
    const { result } = await _renderReady([])
    vi.mocked(chatService.getOlderPage).mockResolvedValueOnce(_page([1, 2], null))

    act(() => _serverEmit('connect'))

    await waitFor(() => expect(_ids(result.current.msgs)).toEqual([1, 2].map(_msgId)))
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it('keeps the msgs and shows a user msg when the fill fails', async () => {
    const { result } = await _renderReady([1, 2])
    vi.mocked(chatService.getNewerPage).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'down'))

    act(() => _serverEmit('connect'))

    await waitFor(() => expect(useUserMsgStore.getState().msg?.type).toBe('error'))
    expect(_ids(result.current.msgs)).toEqual([1, 2].map(_msgId))
  })

  it('retries a first open that failed', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'disconnected'),
    )
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
    const { result } = _render(_CAT_ID, true)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => _serverEmit('connect'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(_ids(result.current.msgs)).toEqual([_msgId(1)])
  })
})

describe('useCatChat failed join', () => {
  it('retryLoadChat joins again, then fetches', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'timeout'),
    )
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
    const { result } = _render(_CAT_ID, true)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.retryLoadChat())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(_joinCalls()).toHaveLength(2)
    expect(_ids(result.current.msgs)).toEqual([_msgId(1)])
  })

  it('redirects to the cat list when the cat is gone', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValue(
      new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found'),
    )

    _render()

    await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith('/cat', { replace: true }))
    expect(useUserMsgStore.getState().navigationMsg).toMatchObject({
      txt: 'This cat was deleted',
      type: 'error',
    })
  })

  // A socket that was offline when the cat was deleted learns it from the rejoin
  it('redirects when a rejoin finds the cat gone', async () => {
    await _renderReady([1])
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found'),
    )

    act(() => _serverEmit('connect'))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/cat', { replace: true }))
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it("doesn't redirect on another join failure", async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'timeout'),
    )
    const { result } = _render(_CAT_ID, true)

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it("drops a redirect from the old cat's join after a switch", async () => {
    const oldJoin = _deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(
      oldJoin.promise.then(() => {
        throw new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found')
      }),
    )
    const { rerender } = _render()

    rerender({ catId: _OTHER_CAT_ID, isOpen: false })
    await act(async () => oldJoin.resolve({}))

    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('useCatChat sendMsg', () => {
  const _VIEWER: LoggedInUser = {
    _id: 'user-1',
    username: 'maya',
    fullname: 'Maya Levi',
    isAdmin: false,
  }

  // The ack of a chat:msg-add. Joins still get the default {}
  function _mockSendAck(ack: () => Promise<unknown>) {
    vi.mocked(socketService.emitWithAck).mockImplementation((event) =>
      event === 'chat:msg-add' ? ack() : Promise.resolve({}),
    )
  }

  function _sendCalls() {
    return vi
      .mocked(socketService.emitWithAck)
      .mock.calls.filter(([event]) => event === 'chat:msg-add')
  }

  // The saved copy the server would return for the nth send
  function _savedMsg(n: number, sendIndex = 0): ChatMsg {
    const payload = _sendCalls()[sendIndex][1] as ChatMsgInput
    return { ..._msg(n), isDeleted: false, clientMsgId: payload.clientMsgId, text: payload.text }
  }

  beforeEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: _VIEWER })
  })

  it('shows the msg as pending at once and sends it with a fresh clientMsgId', async () => {
    _mockSendAck(() => new Promise(() => {}))
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Is she ok with dogs?'))

    expect(result.current.pendingMsgs).toMatchObject([
      {
        catId: _CAT_ID,
        text: 'Is she ok with dogs?',
        sendStatus: 'sending',
        user: { _id: _VIEWER._id, fullname: _VIEWER.fullname, isAdmin: false },
      },
    ])
    const [[, payload]] = _sendCalls()
    expect(payload).toEqual({
      catId: _CAT_ID,
      clientMsgId: result.current.pendingMsgs[0].clientMsgId,
      text: 'Is she ok with dogs?',
    })
    expect((payload as ChatMsgInput).clientMsgId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('replaces the pending msg with the saved one from the ack', async () => {
    const ack = _deferred<unknown>()
    _mockSendAck(() => ack.promise)
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Hi'))
    await act(async () => ack.resolve({ msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  // The server broadcasts to the sending socket too, and the broadcast can beat the ack
  it('replaces the pending msg on the broadcast, and the ack after it only dedupes', async () => {
    const ack = _deferred<unknown>()
    _mockSendAck(() => ack.promise)
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Hi'))
    act(() => _serverEmit('chat:msg-added', { msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    await act(async () => ack.resolve({ msg: _savedMsg(2) }))
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  it('marks the msg failed on a timeout, and the user stays logged in', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'operation has timed out')))
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Hi'))

    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    expect(result.current.pendingMsgs[0].text).toBe('Hi')
    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_VIEWER)
    expect(useUserMsgStore.getState().msg).toBeNull()
    expect(chatService.saveDraft).not.toHaveBeenCalled()
  })

  // A disconnect while the packet was in flight: the server may have saved it after all
  it('turns a failed msg into the saved one when its broadcast arrives late', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await _renderReady([1])
    act(() => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))

    act(() => _serverEmit('chat:msg-added', { msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  it('turns a failed msg into the saved one when the gap fill brings it', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'disconnected')))
    const { result } = await _renderReady([1])
    act(() => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    vi.mocked(chatService.getNewerPage).mockResolvedValue({
      msgs: [_savedMsg(2)],
      nextAfterId: null,
    })

    act(() => _serverEmit('connect'))

    await waitFor(() => expect(result.current.pendingMsgs).toEqual([]))
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  // The timeout fires after the server saved it, and the broadcast got through first
  it('keeps a msg saved when its send fails after the broadcast', async () => {
    let rejectAck!: (err: unknown) => void
    _mockSendAck(() => new Promise((_, reject) => (rejectAck = reject)))
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Hi'))
    act(() => _serverEmit('chat:msg-added', { msg: _savedMsg(2) }))
    await act(async () => rejectAck(new ApiError(0, 'NETWORK_ERROR', 'timeout')))

    expect(result.current.pendingMsgs).toEqual([])
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  it('retries with the same clientMsgId, then shows the saved msg', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await _renderReady([1])
    act(() => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    const ack = _deferred<unknown>()
    _mockSendAck(() => ack.promise)

    act(() => result.current.retrySendMsg(result.current.pendingMsgs[0].clientMsgId))

    expect(result.current.pendingMsgs[0].sendStatus).toBe('sending')
    const [first, retried] = _sendCalls()
    expect(retried[1]).toEqual(first[1])
    await act(async () => ack.resolve({ msg: _savedMsg(2, 1) }))
    expect(result.current.pendingMsgs).toEqual([])
    expect(_ids(result.current.msgs)).toEqual([_msgId(1), _msgId(2)])
  })

  it("doesn't retry once the viewer is no longer the author", async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await _renderReady([1])
    act(() => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))

    act(() => useLoggedInUserStore.setState({ loggedInUser: null }))
    act(() => result.current.retrySendMsg(result.current.pendingMsgs[0].clientMsgId))

    expect(_sendCalls()).toHaveLength(1)
    expect(result.current.pendingMsgs[0].sendStatus).toBe('failed')
  })

  it('keeps the text as failed, saves the draft and says why on UNAUTHORIZED', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
    const { result } = await _renderReady([1])

    act(() => result.current.sendMsg('Hi'))

    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    expect(result.current.pendingMsgs[0].text).toBe('Hi')
    expect(chatService.saveDraft).toHaveBeenCalledExactlyOnceWith(_CAT_ID, 'Hi')
    expect(useUserMsgStore.getState().msg).toMatchObject({
      type: 'error',
      txt: 'Your session expired. Log in to keep chatting.',
    })
  })

  it("drops a late ack from the old cat's send after a switch", async () => {
    const ack = _deferred<unknown>()
    _mockSendAck(() => ack.promise)
    const { result, rerender } = await _renderReady([1])
    act(() => result.current.sendMsg('Hi'))
    const savedMsg = _savedMsg(2)

    rerender({ catId: _OTHER_CAT_ID, isOpen: false })
    await act(async () => ack.resolve({ msg: savedMsg }))

    expect(result.current.msgs).toEqual([])
    expect(result.current.pendingMsgs).toEqual([])
  })
})

describe('useCatChat updateMsg and removeMsg', () => {
  const _AUTHOR: LoggedInUser = {
    _id: 'user-1',
    username: 'maya',
    fullname: 'Maya Levi',
    isAdmin: false,
  }

  // The acks of chat:msg-update / remove. Joins still get the default {}
  function _mockChangeAck(ack: () => Promise<unknown>) {
    vi.mocked(socketService.emitWithAck).mockImplementation((event) =>
      event === 'chat:msg-update' || event === 'chat:msg-remove' ? ack() : Promise.resolve({}),
    )
  }

  function _editedMsg(n: number, text = 'edited'): ChatMsg {
    return { ..._msg(n), isDeleted: false, text, updatedAt: n + 100 }
  }

  // A remove sets only isDeleted: updatedAt stays
  function _tombstone(n: number): ChatMsg {
    const { _id, catId, clientMsgId, createdAt, updatedAt, user } = _msg(n)
    return { _id, catId, clientMsgId, createdAt, updatedAt, user, isDeleted: true }
  }

  function _textOf(msg: ChatMsg | undefined) {
    return msg && !msg.isDeleted ? msg.text : null
  }

  beforeEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: _AUTHOR })
  })

  describe('updateMsg', () => {
    it('keeps the msg busy until the ack, then shows the edit', async () => {
      const ack = _deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result } = await _renderReady([1, 2])

      let saved!: Promise<boolean>
      act(() => {
        saved = result.current.updateMsg(_msgId(1), 'edited')
      })

      expect(socketService.emitWithAck).toHaveBeenLastCalledWith('chat:msg-update', {
        catId: _CAT_ID,
        msgId: _msgId(1),
        text: 'edited',
      })
      expect(result.current.busyMsgs).toEqual({ [_msgId(1)]: 'updating' })
      expect(_textOf(result.current.msgs[0])).toBe('msg 1') // not optimistic

      await act(async () => ack.resolve({ msg: _editedMsg(1) }))

      await expect(saved).resolves.toBe(true)
      expect(result.current.busyMsgs).toEqual({})
      expect(_textOf(result.current.msgs[0])).toBe('edited')
    })

    it.each([
      ['a timeout', new ApiError(0, 'NETWORK_ERROR', 'operation has timed out')],
      ['an error ack', new ApiError(0, 'CHAT_MSG_NOT_FOUND', 'Chat msg not found')],
    ])('puts the msg back and says why on %s', async (_label, err) => {
      _mockChangeAck(() => Promise.reject(err))
      const { result } = await _renderReady([1])

      let saved!: Promise<boolean>
      act(() => {
        saved = result.current.updateMsg(_msgId(1), 'edited')
      })

      await expect(saved).resolves.toBe(false)
      await waitFor(() => expect(result.current.busyMsgs).toEqual({}))
      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
      expect(useUserMsgStore.getState().msg?.txt).toMatch(/^Couldn't save your edit\./)
      expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_AUTHOR)
    })

    it('says the session expired on UNAUTHORIZED, with no draft', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
      const { result } = await _renderReady([1])

      await act(() => result.current.updateMsg(_msgId(1), 'edited'))

      expect(useUserMsgStore.getState().msg).toMatchObject({
        type: 'error',
        txt: 'Your session expired. Log in to keep chatting.',
      })
      expect(chatService.saveDraft).not.toHaveBeenCalled()
      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
    })

    it("drops a late ack from the old cat's edit after a switch", async () => {
      const ack = _deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result, rerender } = await _renderReady([1])
      act(() => void result.current.updateMsg(_msgId(1), 'edited'))

      rerender({ catId: _OTHER_CAT_ID, isOpen: false })
      await act(async () => ack.resolve({ msg: _editedMsg(1) }))

      expect(result.current.msgs).toEqual([])
      expect(result.current.busyMsgs).toEqual({})
    })
  })

  describe('removeMsg', () => {
    it('keeps the msg busy until the ack, then shows the tombstone', async () => {
      const ack = _deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result } = await _renderReady([1])

      act(() => void result.current.removeMsg(_msgId(1)))

      expect(socketService.emitWithAck).toHaveBeenLastCalledWith('chat:msg-remove', {
        catId: _CAT_ID,
        msgId: _msgId(1),
      })
      expect(result.current.busyMsgs).toEqual({ [_msgId(1)]: 'removing' })
      expect(result.current.msgs[0].isDeleted).toBe(false)

      await act(async () => ack.resolve({ msg: _tombstone(1) }))

      expect(result.current.busyMsgs).toEqual({})
      expect(result.current.msgs[0].isDeleted).toBe(true)
    })

    it('puts the msg back and says why on a timeout', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
      const { result } = await _renderReady([1])

      await act(() => result.current.removeMsg(_msgId(1)))

      expect(result.current.busyMsgs).toEqual({})
      expect(result.current.msgs[0].isDeleted).toBe(false)
      expect(useUserMsgStore.getState().msg?.txt).toMatch(/^Couldn't delete it\./)
    })

    it('says the session expired on UNAUTHORIZED', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
      const { result } = await _renderReady([1])

      await act(() => result.current.removeMsg(_msgId(1)))

      expect(useUserMsgStore.getState().msg?.txt).toBe(
        'Your session expired. Log in to keep chatting.',
      )
    })
  })

  describe('chat:msg-updated and chat:msg-removed', () => {
    it('replaces the held msg by _id', async () => {
      const { result } = await _renderReady([1, 2])

      act(() => _serverEmit('chat:msg-updated', { msg: _editedMsg(1) }))
      act(() => _serverEmit('chat:msg-removed', { msg: _tombstone(2) }))

      expect(_ids(result.current.msgs)).toEqual([1, 2].map(_msgId))
      expect(_textOf(result.current.msgs[0])).toBe('edited')
      expect(result.current.msgs[1].isDeleted).toBe(true)
    })

    it('drops a change for another cat', async () => {
      const { result } = await _renderReady([1])

      act(() =>
        _serverEmit('chat:msg-updated', { msg: { ..._editedMsg(1), catId: _OTHER_CAT_ID } }),
      )

      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
    })

    it("doesn't count a change as unread", async () => {
      const { result, rerender } = await _renderReady([1])
      rerender({ catId: _CAT_ID, isOpen: false })

      act(() => _serverEmit('chat:msg-updated', { msg: _editedMsg(1) }))

      expect(result.current.unreadCount).toBe(0)
    })

    // Inserting it would leave it alone above a gap, and "load older" pages from the oldest
    // held _id, so it would skip every msg in between
    it("doesn't add a msg the log hasn't loaded", async () => {
      const { result } = await _renderReady([5, 6], _msgId(5))

      act(() => _serverEmit('chat:msg-removed', { msg: _tombstone(1) }))

      expect(_ids(result.current.msgs)).toEqual([5, 6].map(_msgId))
    })

    // The page was read before the edit, and lands after its event
    it('keeps a change seen live over the older copy a later fetch brings', async () => {
      const page = _deferred<ChatMsgOlderPage>()
      vi.mocked(chatService.getOlderPage).mockReturnValue(page.promise)
      const { result } = _render(_CAT_ID, true)
      await waitFor(() => expect(chatService.getOlderPage).toHaveBeenCalled())

      act(() => _serverEmit('chat:msg-updated', { msg: _editedMsg(2) }))
      act(() => _serverEmit('chat:msg-removed', { msg: _tombstone(1) }))
      await act(async () => page.resolve(_page([1, 2], null)))

      expect(result.current.msgs[0].isDeleted).toBe(true)
      expect(_textOf(result.current.msgs[1])).toBe('edited')
    })
  })
})
