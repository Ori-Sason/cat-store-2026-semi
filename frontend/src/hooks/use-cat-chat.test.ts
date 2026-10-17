import type { ChatMsg, ChatMsgNewerPage, ChatMsgOlderPage } from '@cat-store/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { chatService } from '../services/chat.service'
import { socketService } from '../services/socket.service'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { useUserMsgStore } from '../store/user-msg.store'
import { useCatChat } from './use-cat-chat'

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

    it('ignores a second call while one is loading', async () => {
      const older = _deferred<ChatMsgOlderPage>()
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(_page([5, 6], _msgId(5)))
        .mockReturnValueOnce(older.promise)
      const { result } = _render(_CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      act(() => {
        void result.current.loadOlder()
        void result.current.loadOlder()
      })
      expect(result.current.isLoadingOlder).toBe(true)
      await act(async () => older.resolve(_page([4], null)))

      expect(chatService.getOlderPage).toHaveBeenCalledTimes(2)
      expect(result.current.isLoadingOlder).toBe(false)
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
  it('retry joins again, then fetches', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'timeout'),
    )
    vi.mocked(chatService.getOlderPage).mockResolvedValue(_page([1], null))
    const { result } = _render(_CAT_ID, true)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.retry())

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
