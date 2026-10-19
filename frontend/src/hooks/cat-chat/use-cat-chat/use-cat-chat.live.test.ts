import type { ChatMsg } from '@cat-store/shared'
import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { chatService } from '../../../services/chat.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import {
  VIEWER,
  makeTombstone,
  CAT_ID,
  OTHER_CAT_ID,
  socketListeners,
  makeMsgId,
  makeMsg,
  makePage,
  idsOf,
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

describe('useCatChat live msgs', () => {
  it('inserts a msg-added event in _id order', async () => {
    const { result } = await renderReadyChat([1, 3])

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2) }))

    expect(idsOf(result.current.msgs)).toEqual([1, 2, 3].map(makeMsgId))
  })

  it('dedupes an event for a msg the first page already holds', async () => {
    const { result } = await renderReadyChat([1, 2])

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2) }))

    expect(idsOf(result.current.msgs)).toEqual([1, 2].map(makeMsgId))
  })

  // Joined on mount, fetched on open: a msg sent in between arrives live and isn't lost
  it('merges the events since the join with the first page', async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1, 2], null))
    const { result, rerender } = renderChat()

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(3) }))
    rerender({ catId: CAT_ID, isOpen: true })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(idsOf(result.current.msgs)).toEqual([1, 2, 3].map(makeMsgId))
  })

  it('drops an event for another cat', async () => {
    const { result } = await renderReadyChat([1])

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2, OTHER_CAT_ID) }))

    expect(idsOf(result.current.msgs)).toEqual([makeMsgId(1)])
  })

  it('keeps events for the cat when the route param is uppercase', async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([1], null))
    const { result } = renderChat(CAT_ID.toUpperCase(), true)
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2) }))

    expect(idsOf(result.current.msgs)).toEqual([1, 2].map(makeMsgId))
  })

  it('stops listening to the old cat after a switch', async () => {
    const { result, rerender } = await renderReadyChat([1])

    rerender({ catId: OTHER_CAT_ID, isOpen: false })
    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2) }))

    expect(result.current.msgs).toEqual([])
    expect(socketListeners.get('chat:msg-added')?.size).toBe(1)
  })

  it('removes its listeners on unmount', () => {
    const { unmount } = renderChat()

    unmount()

    expect(socketListeners.get('chat:msg-added')?.size).toBe(0)
    expect(socketListeners.get('connect')?.size).toBe(0)
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
    const { result, rerender } = renderChat()
    act(() => serverEmit('chat:msg-added', { msg: liveMsg }))
    rerender({ catId: CAT_ID, isOpen: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    return result.current.msgs
  }

  const _edited: ChatMsg = { ...makeMsg(1), isDeleted: false, updatedAt: 100, text: 'edited' }
  const _tombstone = makeTombstone(1)

  it('keeps an edit when a stale copy lands after it', async () => {
    expect(await _openAfterLiveCopy(_edited, makeMsg(1))).toEqual([_edited])
  })

  it('takes a copy with a later updatedAt', async () => {
    expect(await _openAfterLiveCopy(makeMsg(1), _edited)).toEqual([_edited])
  })

  // A remove doesn't touch updatedAt, so the tombstone can't win by the timestamp
  it('takes a tombstone over a live copy with the same updatedAt', async () => {
    expect(await _openAfterLiveCopy(makeMsg(1), _tombstone)).toEqual([_tombstone])
  })

  it('never brings a deleted msg back', async () => {
    expect(await _openAfterLiveCopy(_tombstone, _edited)).toEqual([_tombstone])
  })
})

describe('useCatChat unread count', () => {
  it("counts others' msgs while the panel is closed", () => {
    const { result } = renderChat()

    act(() => {
      serverEmit('chat:msg-added', { msg: makeMsg(1) })
      serverEmit('chat:msg-added', { msg: makeMsg(2) })
    })

    expect(result.current.unreadCount).toBe(2)
  })

  it("doesn't count the viewer's own msgs", () => {
    useLoggedInUserStore.setState({
      loggedInUser: VIEWER,
    })
    const { result } = renderChat()

    act(() => serverEmit('chat:msg-added', { msg: makeMsg(1) }))

    expect(result.current.unreadCount).toBe(0)
  })

  it('counts a msg whose author is gone', () => {
    const { result } = renderChat()

    act(() => serverEmit('chat:msg-added', { msg: { ...makeMsg(1), user: null } }))

    expect(result.current.unreadCount).toBe(1)
  })

  it("resets on open, doesn't count while open, and starts over after a close", async () => {
    vi.mocked(chatService.getOlderPage).mockResolvedValue(makePage([], null))
    const { result, rerender } = renderChat()
    act(() => serverEmit('chat:msg-added', { msg: makeMsg(1) }))

    rerender({ catId: CAT_ID, isOpen: true })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => serverEmit('chat:msg-added', { msg: makeMsg(2) }))
    expect(result.current.unreadCount).toBe(0)

    rerender({ catId: CAT_ID, isOpen: false })
    expect(result.current.unreadCount).toBe(0)
    act(() => serverEmit('chat:msg-added', { msg: makeMsg(3) }))
    expect(result.current.unreadCount).toBe(1)
  })
})
