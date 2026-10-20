import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../models/api-error'
import { chatService } from '../../../services/chat.service'
import { socketService } from '../../../services/socket.service'
import { useUserMsgStore } from '../../../store/user-msg.store'
import {
  CAT_ID,
  makeMsgId,
  makeMsg,
  makePage,
  makeNewerPage,
  idsOf,
  deferred,
  serverEmit,
  joinCalls,
  renderChat,
  renderReadyChat,
  setupChatTest,
} from './chat-test.helper'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../../../services/socket.service')
vi.mock('../../../services/chat.service')
// Only the redirect is checked, so a stand-in navigate is enough. The hook needs no router
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))

setupChatTest()

describe('useCatChat reconnect', () => {
  it('rejoins the room on every connect', () => {
    renderChat()

    act(() => serverEmit('connect'))
    act(() => serverEmit('connect'))

    expect(joinCalls()).toHaveLength(3)
    expect(joinCalls().at(-1)).toEqual(['chat:join', { catId: CAT_ID }])
  })

  it('only rejoins a chat that was never opened: the first open fetches', () => {
    renderChat()

    act(() => serverEmit('connect'))

    expect(chatService.getOlderPage).not.toHaveBeenCalled()
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it('fills the gap after the rejoin ack, page by page', async () => {
    const { result } = await renderReadyChat([1, 2])
    const rejoin = deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(rejoin.promise)
    vi.mocked(chatService.getNewerPage)
      .mockResolvedValueOnce(makeNewerPage([3, 4], makeMsgId(4)))
      .mockResolvedValueOnce(makeNewerPage([5], null))

    act(() => serverEmit('connect'))
    await act(() => Promise.resolve())
    expect(chatService.getNewerPage).not.toHaveBeenCalled()

    await act(async () => rejoin.resolve({}))

    await waitFor(() => expect(idsOf(result.current.msgs)).toEqual([1, 2, 3, 4, 5].map(makeMsgId)))
    expect(vi.mocked(chatService.getNewerPage).mock.calls).toEqual([
      [CAT_ID, makeMsgId(2)],
      [CAT_ID, makeMsgId(4)],
    ])
  })

  // A live msg that lands after the rejoin is newer than the gap, so it can't be the cursor
  it('fills from the newest msg held before the drop', async () => {
    const { result } = await renderReadyChat([1, 2])
    const rejoin = deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(rejoin.promise)
    vi.mocked(chatService.getNewerPage).mockResolvedValue(makeNewerPage([3, 4], null))

    act(() => serverEmit('connect'))
    act(() => serverEmit('chat:msg-added', { msg: makeMsg(4) }))
    await act(async () => rejoin.resolve({}))

    await waitFor(() => expect(idsOf(result.current.msgs)).toEqual([1, 2, 3, 4].map(makeMsgId)))
    expect(chatService.getNewerPage).toHaveBeenCalledExactlyOnceWith(CAT_ID, makeMsgId(2))
  })

  it('refetches the newest page when the log was empty', async () => {
    const { result } = await renderReadyChat([])
    vi.mocked(chatService.getOlderPage).mockResolvedValueOnce(makePage([1, 2], null))

    act(() => serverEmit('connect'))

    await waitFor(() => expect(idsOf(result.current.msgs)).toEqual([1, 2].map(makeMsgId)))
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it('keeps the msgs and shows a user msg when the fill fails', async () => {
    const { result } = await renderReadyChat([1, 2])
    vi.mocked(chatService.getNewerPage).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'down'))

    act(() => serverEmit('connect'))

    await waitFor(() => expect(useUserMsgStore.getState().msg?.type).toBe('error'))
    expect(idsOf(result.current.msgs)).toEqual([1, 2].map(makeMsgId))
  })

  it('retries a first open that failed', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'disconnected'),
    )
    vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1], null))
    const { result } = renderChat(CAT_ID, true)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => serverEmit('connect'))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1)])
  })
})

describe('useCatChat failed join', () => {
  it('retryLoadChat joins again, then fetches', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR', 'timeout'),
    )
    vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1], null))
    const { result } = renderChat(CAT_ID, true)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.retryLoadChat())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(joinCalls()).toHaveLength(2)
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1)])
  })

  it('redirects to the cat list when the cat is gone', async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValue(
      new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found'),
    )

    renderChat()

    await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith('/cat', { replace: true }))
    expect(useUserMsgStore.getState().navigationMsg).toMatchObject({
      txt: 'This cat was deleted',
      type: 'error',
    })
  })

  // The viewer's own delete: a join still in flight when the DELETE commits acks CAT_NOT_FOUND
  it("doesn't redirect while the page's own delete is in flight", async () => {
    let reject!: (err: unknown) => void
    const pendingJoin = new Promise<object>((_, rej) => (reject = rej))
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(pendingJoin)
    const { rerender } = renderChat()

    useUserMsgStore.getState().queueSuccessNavigationMsg('Cat deleted')
    rerender({ catId: CAT_ID, isOpen: false, isCatDeleting: true })
    await act(async () => {
      reject(new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found'))
      await pendingJoin.catch(() => {})
    })

    expect(navigate).not.toHaveBeenCalled()
    expect(useUserMsgStore.getState().navigationMsg).toMatchObject({ txt: 'Cat deleted' })
  })

  // A socket that was offline when the cat was deleted learns it from the rejoin
  it('redirects when a rejoin finds the cat gone', async () => {
    await renderReadyChat([1])
    vi.mocked(socketService.emitWithAck).mockRejectedValueOnce(
      new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found'),
    )

    act(() => serverEmit('connect'))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/cat', { replace: true }))
    expect(chatService.getNewerPage).not.toHaveBeenCalled()
  })

  it("doesn't redirect on another join failure", async () => {
    vi.mocked(socketService.emitWithAck).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'timeout'),
    )
    const { result } = renderChat(CAT_ID, true)

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  // The visitor already left the page: a redirect now would pull them off where they went
  it('drops a redirect from a join that fails after unmount', async () => {
    const oldJoin = deferred<object>()
    vi.mocked(socketService.emitWithAck).mockReturnValueOnce(
      oldJoin.promise.then(() => {
        throw new ApiError(0, 'CAT_NOT_FOUND', 'Cat not found')
      }),
    )
    const { unmount } = renderChat()

    unmount()
    await act(async () => oldJoin.resolve({}))

    expect(navigate).not.toHaveBeenCalled()
  })
})
