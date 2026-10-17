import type { ChatMsg, ChatMsgOlderPage } from '@cat-store/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { chatService } from '../services/chat.service'
import { socketService } from '../services/socket.service'
import { useUserMsgStore } from '../store/user-msg.store'
import { useCatChat } from './use-cat-chat'

vi.mock('../services/socket.service')
vi.mock('../services/chat.service')

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

describe('useCatChat history', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState(useUserMsgStore.getInitialState())
    vi.mocked(socketService.emitWithAck).mockResolvedValue({})
  })

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
