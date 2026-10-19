import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../models/api-error'
import { chatService } from '../../../services/chat.service'
import { socketService } from '../../../services/socket.service'
import { useUserMsgStore } from '../../../store/user-msg.store'
import {
  CAT_ID,
  makeMsgId,
  makePage,
  idsOf,
  deferred,
  renderChat,
  setupChatTest,
} from './chat-test.helper'
import { useCatChat } from './use-cat-chat'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../../../services/socket.service')
vi.mock('../../../services/chat.service')
// Only the redirect is checked, so a stand-in navigate is enough. The hook needs no router
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))

setupChatTest()

describe('useCatChat history', () => {
  describe('join and leave', () => {
    it('joins the room on mount and leaves it on unmount', () => {
      const { unmount } = renderChat()

      expect(socketService.emitWithAck).toHaveBeenCalledExactlyOnceWith('chat:join', {
        catId: CAT_ID,
      })

      unmount()

      expect(socketService.emit).toHaveBeenCalledExactlyOnceWith('chat:leave', { catId: CAT_ID })
    })

    // Dev mode runs mount effects twice: join → leave → join, and the room stays joined
    it('ends joined under StrictMode, and the first open fetches once', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1], null))
      const { result, rerender } = renderHook((props) => useCatChat(props.catId, props.isOpen), {
        initialProps: { catId: CAT_ID, isOpen: false },
        wrapper: StrictMode,
      })

      expect(vi.mocked(socketService.emitWithAck).mock.calls.map(([event]) => event)).toEqual([
        'chat:join',
        'chat:join',
      ])
      expect(socketService.emit).toHaveBeenCalledExactlyOnceWith('chat:leave', { catId: CAT_ID })

      rerender({ catId: CAT_ID, isOpen: true })

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(chatService.getOlderPage).toHaveBeenCalledOnce()
    })

    it('does not fetch while the chat is closed', () => {
      const { result } = renderChat()

      expect(chatService.getOlderPage).not.toHaveBeenCalled()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('the first open', () => {
    it('waits for the join ack, then fetches the newest page', async () => {
      const join = deferred<object>()
      vi.mocked(socketService.emitWithAck).mockReturnValue(join.promise)
      vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1, 2], null))
      const { result, rerender } = renderChat()

      rerender({ catId: CAT_ID, isOpen: true })
      await act(() => Promise.resolve())
      expect(result.current.status).toBe('loading')
      expect(chatService.getOlderPage).not.toHaveBeenCalled()

      await act(async () => join.resolve({}))

      expect(chatService.getOlderPage).toHaveBeenCalledExactlyOnceWith(CAT_ID)
      expect(result.current.status).toBe('ready')
      expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
    })

    it('fetches once: closing and reopening keeps the msgs', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1], null))
      const { result, rerender } = renderChat(CAT_ID, true)
      await waitFor(() => expect(result.current.status).toBe('ready'))

      rerender({ catId: CAT_ID, isOpen: false })
      rerender({ catId: CAT_ID, isOpen: true })

      expect(chatService.getOlderPage).toHaveBeenCalledOnce()
      expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1)])
    })

    it('shows the error state when the join fails', async () => {
      vi.mocked(socketService.emitWithAck).mockRejectedValue(
        new ApiError(0, 'NETWORK_ERROR', 'timeout'),
      )

      const { result } = renderChat(CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('error'))
      expect(chatService.getOlderPage).not.toHaveBeenCalled()
    })

    it('shows the error state when the fetch fails', async () => {
      vi.mocked(chatService.getOlderPage).mockRejectedValue(
        new ApiError(0, 'NETWORK_ERROR', 'down'),
      )

      const { result } = renderChat(CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('error'))
    })
  })

  describe('load older', () => {
    it('offers older msgs while the server has more', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([5, 6], makeMsgId(5)))

      const { result } = renderChat(CAT_ID, true)

      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))
    })

    it('offers nothing older when the first page is the whole log', async () => {
      vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([5, 6], null))

      const { result } = renderChat(CAT_ID, true)

      await waitFor(() => expect(result.current.status).toBe('ready'))
      expect(result.current.isOlderAvailable).toBe(false)
    })

    it('fetches before the oldest held msg and keeps the list in _id order', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(makePage([5, 6], makeMsgId(5)))
        .mockResolvedValueOnce(makePage([3, 4], null))
      const { result } = renderChat(CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(chatService.getOlderPage).toHaveBeenLastCalledWith(CAT_ID, makeMsgId(5))
      expect(idsOf(result.current.msgs)).toEqual([3, 4, 5, 6].map(makeMsgId))
      expect(result.current.isOlderAvailable).toBe(false)
    })

    it('dedupes a msg that is already held', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(makePage([5, 6], makeMsgId(5)))
        .mockResolvedValueOnce(makePage([4, 5], makeMsgId(4)))
      const { result } = renderChat(CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(idsOf(result.current.msgs)).toEqual([4, 5, 6].map(makeMsgId))
    })

    it('shows a user msg on a failure and still offers older msgs', async () => {
      vi.mocked(chatService.getOlderPage)
        .mockResolvedValueOnce(makePage([5, 6], makeMsgId(5)))
        .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'down'))
      const { result } = renderChat(CAT_ID, true)
      await waitFor(() => expect(result.current.isOlderAvailable).toBe(true))

      await act(() => result.current.loadOlder())

      expect(useUserMsgStore.getState().msg?.type).toBe('error')
      expect(result.current.isOlderAvailable).toBe(true)
      expect(result.current.isLoadingOlder).toBe(false)
    })
  })
})
