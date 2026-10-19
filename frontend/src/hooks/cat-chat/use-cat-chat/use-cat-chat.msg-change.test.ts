import type { ChatMsg, ChatMsgOlderPage } from '@cat-store/shared'
import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../models/api-error'
import { chatService } from '../../../services/chat.service'
import { socketService } from '../../../services/socket.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { useUserMsgStore } from '../../../store/user-msg.store'
import {
  VIEWER,
  makeTombstone,
  CAT_ID,
  OTHER_CAT_ID,
  makeMsgId,
  makeMsg,
  makePage,
  idsOf,
  deferred,
  serverEmit,
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

describe('useCatChat updateMsg and removeMsg', () => {
  // The acks of chat:msg-update / remove. Joins still get the default {}
  function _mockChangeAck(ack: () => Promise<unknown>) {
    vi.mocked(socketService.emitWithAck).mockImplementation((event) =>
      event === 'chat:msg-update' || event === 'chat:msg-remove' ? ack() : Promise.resolve({}),
    )
  }

  function _editedMsg(n: number, text = 'edited'): ChatMsg {
    return { ...makeMsg(n), isDeleted: false, text, updatedAt: n + 100 }
  }

  function _textOf(msg: ChatMsg | undefined) {
    return msg && !msg.isDeleted ? msg.text : null
  }

  beforeEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: VIEWER })
  })

  describe('updateMsg', () => {
    it('keeps the msg busy until the ack, then shows the edit', async () => {
      const ack = deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result } = await renderReadyChat([1, 2])

      let saved!: Promise<boolean>
      act(() => {
        saved = result.current.updateMsg(makeMsgId(1), 'edited')
      })

      expect(socketService.emitWithAck).toHaveBeenLastCalledWith('chat:msg-update', {
        catId: CAT_ID,
        msgId: makeMsgId(1),
        text: 'edited',
      })
      expect(result.current.busyMsgs).toEqual({ [makeMsgId(1)]: 'updating' })
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
      const { result } = await renderReadyChat([1])

      let saved!: Promise<boolean>
      act(() => {
        saved = result.current.updateMsg(makeMsgId(1), 'edited')
      })

      await expect(saved).resolves.toBe(false)
      await waitFor(() => expect(result.current.busyMsgs).toEqual({}))
      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
      expect(useUserMsgStore.getState().msg?.txt).toMatch(/^Couldn't save your edit\./)
      expect(useLoggedInUserStore.getState().loggedInUser).toEqual(VIEWER)
    })

    it('says the session expired on UNAUTHORIZED, with no draft', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
      const { result } = await renderReadyChat([1])

      await act(() => result.current.updateMsg(makeMsgId(1), 'edited'))

      expect(useUserMsgStore.getState().msg).toMatchObject({
        type: 'error',
        txt: 'Your session expired. Log in to keep chatting.',
      })
      expect(chatService.saveDraft).not.toHaveBeenCalled()
      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
    })

    it("drops a late ack from the old cat's edit after a switch", async () => {
      const ack = deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result, rerender } = await renderReadyChat([1])
      act(() => void result.current.updateMsg(makeMsgId(1), 'edited'))

      rerender({ catId: OTHER_CAT_ID, isOpen: false })
      await act(async () => ack.resolve({ msg: _editedMsg(1) }))

      expect(result.current.msgs).toEqual([])
      expect(result.current.busyMsgs).toEqual({})
    })
  })

  describe('removeMsg', () => {
    it('keeps the msg busy until the ack, then shows the tombstone', async () => {
      const ack = deferred<unknown>()
      _mockChangeAck(() => ack.promise)
      const { result } = await renderReadyChat([1])

      act(() => void result.current.removeMsg(makeMsgId(1)))

      expect(socketService.emitWithAck).toHaveBeenLastCalledWith('chat:msg-remove', {
        catId: CAT_ID,
        msgId: makeMsgId(1),
      })
      expect(result.current.busyMsgs).toEqual({ [makeMsgId(1)]: 'removing' })
      expect(result.current.msgs[0].isDeleted).toBe(false)

      await act(async () => ack.resolve({ msg: makeTombstone(1) }))

      expect(result.current.busyMsgs).toEqual({})
      expect(result.current.msgs[0].isDeleted).toBe(true)
    })

    it('puts the msg back and says why on a timeout', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'timeout')))
      const { result } = await renderReadyChat([1])

      await act(() => result.current.removeMsg(makeMsgId(1)))

      expect(result.current.busyMsgs).toEqual({})
      expect(result.current.msgs[0].isDeleted).toBe(false)
      expect(useUserMsgStore.getState().msg?.txt).toMatch(/^Couldn't delete it\./)
    })

    it('says the session expired on UNAUTHORIZED', async () => {
      _mockChangeAck(() => Promise.reject(new ApiError(0, 'UNAUTHORIZED', 'Login required')))
      const { result } = await renderReadyChat([1])

      await act(() => result.current.removeMsg(makeMsgId(1)))

      expect(useUserMsgStore.getState().msg?.txt).toBe(
        'Your session expired. Log in to keep chatting.',
      )
    })
  })

  describe('chat:msg-updated and chat:msg-removed', () => {
    it('replaces the held msg by _id', async () => {
      const { result } = await renderReadyChat([1, 2])

      act(() => serverEmit('chat:msg-updated', { msg: _editedMsg(1) }))
      act(() => serverEmit('chat:msg-removed', { msg: makeTombstone(2) }))

      expect(idsOf(result.current.msgs)).toEqual([1, 2].map(makeMsgId))
      expect(_textOf(result.current.msgs[0])).toBe('edited')
      expect(result.current.msgs[1].isDeleted).toBe(true)
    })

    it('drops a change for another cat', async () => {
      const { result } = await renderReadyChat([1])

      act(() => serverEmit('chat:msg-updated', { msg: { ..._editedMsg(1), catId: OTHER_CAT_ID } }))

      expect(_textOf(result.current.msgs[0])).toBe('msg 1')
    })

    it("doesn't count a change as unread", async () => {
      const { result, rerender } = await renderReadyChat([1])
      rerender({ catId: CAT_ID, isOpen: false })

      act(() => serverEmit('chat:msg-updated', { msg: _editedMsg(1) }))

      expect(result.current.unreadCount).toBe(0)
    })

    // Inserting it would leave it alone above a gap, and "load older" pages from the oldest
    // held _id, so it would skip every msg in between
    it("doesn't add a msg the log hasn't loaded", async () => {
      const { result } = await renderReadyChat([5, 6], makeMsgId(5))

      act(() => serverEmit('chat:msg-removed', { msg: makeTombstone(1) }))

      expect(idsOf(result.current.msgs)).toEqual([5, 6].map(makeMsgId))
    })

    // The page was read before the edit, and lands after its event
    it('keeps a change seen live over the older copy a later fetch brings', async () => {
      const page = deferred<ChatMsgOlderPage>()
      vi.mocked(chatService.getOlderPage).mockReturnValue(page.promise)
      const { result } = renderChat(CAT_ID, true)
      await waitFor(() => expect(chatService.getOlderPage).toHaveBeenCalled())

      act(() => serverEmit('chat:msg-updated', { msg: _editedMsg(2) }))
      act(() => serverEmit('chat:msg-removed', { msg: makeTombstone(1) }))
      await act(async () => page.resolve(makePage([1, 2], null)))

      expect(result.current.msgs[0].isDeleted).toBe(true)
      expect(_textOf(result.current.msgs[1])).toBe('edited')
    })
  })
})
