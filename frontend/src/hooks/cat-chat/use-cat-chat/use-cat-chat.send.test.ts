import type { ChatMsgWithRefs, ChatMsgInput } from '@cat-store/shared'
import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../models/api-error'
import { chatService } from '../../../services/chat.service'
import { socketService } from '../../../services/socket.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { useUserMsgStore } from '../../../store/user-msg.store'
import {
  VIEWER,
  CAT_ID,
  makeMsgId,
  makeMsg,
  idsOf,
  deferred,
  serverEmit,
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

describe('useCatChat sendMsg', () => {
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
  function _savedMsg(n: number, sendIndex = 0): ChatMsgWithRefs {
    const payload = _sendCalls()[sendIndex][1] as ChatMsgInput
    return { ...makeMsg(n), isDeleted: false, clientMsgId: payload.clientMsgId, text: payload.text }
  }

  beforeEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: VIEWER })
  })

  it('shows the msg as pending at once and sends it with a fresh clientMsgId', async () => {
    _mockSendAck(() => new Promise(() => {}))
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Is she ok with dogs?'))

    expect(result.current.pendingMsgs).toMatchObject([
      {
        catId: CAT_ID,
        text: 'Is she ok with dogs?',
        sendStatus: 'sending',
        user: { _id: VIEWER._id, fullname: VIEWER.fullname, isAdmin: false },
      },
    ])
    const [[, payload]] = _sendCalls()
    expect(payload).toEqual({
      catId: CAT_ID,
      clientMsgId: result.current.pendingMsgs[0].clientMsgId,
      text: 'Is she ok with dogs?',
    })
    expect((payload as ChatMsgInput).clientMsgId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('replaces the pending msg with the saved one from the ack', async () => {
    const ack = deferred<unknown>()
    _mockSendAck(() => ack.promise)
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Hi'))
    await act(async () => ack.resolve({ msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  // The server broadcasts to the sending socket too, and the broadcast can beat the ack
  it('replaces the pending msg on the broadcast, and the ack after it only dedupes', async () => {
    const ack = deferred<unknown>()
    _mockSendAck(() => ack.promise)
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Hi'))
    act(() => serverEmit('chat:msg-added', { msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    await act(async () => ack.resolve({ msg: _savedMsg(2) }))
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  it('marks the msg failed on a timeout, and the user stays logged in', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'operation has timed out')))
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Hi'))

    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    expect(result.current.pendingMsgs[0].text).toBe('Hi')
    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(VIEWER)
    expect(useUserMsgStore.getState().msg).toBeNull()
    expect(chatService.saveDraft).not.toHaveBeenCalled()
  })

  // Regression: a buffered send reached the server before the reconnect's rejoin, as FORBIDDEN
  it('marks the msg failed at once while offline, and sends nothing', async () => {
    const { result } = await renderReadyChat([1])
    vi.mocked(socketService.isConnected).mockReturnValue(false)

    await act(async () => result.current.sendMsg('Hi'))

    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    expect(_sendCalls()).toEqual([])
    expect(useUserMsgStore.getState().msg).toBeNull()
  })

  // Regression: right after a reconnect, a send could beat the rejoin to the server, as FORBIDDEN
  it("holds a send until the rejoin's ack", async () => {
    const { result } = await renderReadyChat([1])
    const rejoinAck = deferred<unknown>()
    vi.mocked(socketService.emitWithAck).mockImplementation((event) =>
      event === 'chat:join' ? rejoinAck.promise : new Promise(() => {}),
    )
    act(() => serverEmit('connect'))

    await act(async () => result.current.sendMsg('Hi'))
    expect(_sendCalls()).toEqual([])

    await act(async () => rejoinAck.resolve({}))
    expect(_sendCalls()).toHaveLength(1)
  })

  // A disconnect while the packet was in flight: the server may have saved it after all
  it('turns a failed msg into the saved one when its broadcast arrives late', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await renderReadyChat([1])
    await act(async () => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))

    act(() => serverEmit('chat:msg-added', { msg: _savedMsg(2) }))

    expect(result.current.pendingMsgs).toEqual([])
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  it('turns a failed msg into the saved one when the gap fill brings it', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'disconnected')))
    const { result } = await renderReadyChat([1])
    await act(async () => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    vi.mocked(chatService.getNewerPage).mockResolvedValue({
      msgs: [_savedMsg(2)],
      nextAfterId: null,
    })

    act(() => serverEmit('connect'))

    await waitFor(() => expect(result.current.pendingMsgs).toEqual([]))
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  // The timeout fires after the server saved it, and the broadcast got through first
  it('keeps a msg saved when its send fails after the broadcast', async () => {
    let rejectAck!: (err: unknown) => void
    _mockSendAck(() => new Promise((_, reject) => (rejectAck = reject)))
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Hi'))
    act(() => serverEmit('chat:msg-added', { msg: _savedMsg(2) }))
    await act(async () => rejectAck(new ApiError(0, 'NETWORK_ERROR', 'timeout')))

    expect(result.current.pendingMsgs).toEqual([])
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  it('retries with the same clientMsgId, then shows the saved msg', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await renderReadyChat([1])
    await act(async () => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    const ack = deferred<unknown>()
    _mockSendAck(() => ack.promise)

    await act(async () => result.current.retrySendMsg(result.current.pendingMsgs[0].clientMsgId))

    expect(result.current.pendingMsgs[0].sendStatus).toBe('sending')
    const [first, retried] = _sendCalls()
    expect(retried[1]).toEqual(first[1])
    await act(async () => ack.resolve({ msg: _savedMsg(2, 1) }))
    expect(result.current.pendingMsgs).toEqual([])
    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1), makeMsgId(2)])
  })

  it("doesn't retry once the viewer is no longer the author", async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
    const { result } = await renderReadyChat([1])
    await act(async () => result.current.sendMsg('Hi'))
    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))

    act(() => useLoggedInUserStore.setState({ loggedInUser: null }))
    await act(async () => result.current.retrySendMsg(result.current.pendingMsgs[0].clientMsgId))

    expect(_sendCalls()).toHaveLength(1)
    expect(result.current.pendingMsgs[0].sendStatus).toBe('failed')
  })

  it('keeps the text as failed, saves the draft and says why on UNAUTHORIZED', async () => {
    _mockSendAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
    const { result } = await renderReadyChat([1])

    await act(async () => result.current.sendMsg('Hi'))

    await waitFor(() => expect(result.current.pendingMsgs[0]?.sendStatus).toBe('failed'))
    expect(result.current.pendingMsgs[0].text).toBe('Hi')
    expect(chatService.saveDraft).toHaveBeenCalledExactlyOnceWith(CAT_ID, 'Hi')
    expect(useUserMsgStore.getState().msg).toMatchObject({
      type: 'error',
      txt: 'Your session expired. Log in to keep chatting.',
    })
  })
})
