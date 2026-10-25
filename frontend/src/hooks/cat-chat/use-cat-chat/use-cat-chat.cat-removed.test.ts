import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUserMsgStore } from '../../../store/user-msg.store'
import { CAT_ID, OTHER_CAT_ID, serverEmit, renderChat, setupChatTest } from './chat-test.helper'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('../../../services/socket.service')
vi.mock('../../../services/chat.service')
// Only the redirect is checked, so a stand-in navigate is enough. The hook needs no router
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))

setupChatTest()

describe('useCatChat cat:removed', () => {
  it('redirects to the cat list when the viewed cat is deleted', () => {
    renderChat()

    act(() => serverEmit('cat:removed', { catId: CAT_ID }))

    expect(navigate).toHaveBeenCalledExactlyOnceWith('/cat', { replace: true })
    expect(useUserMsgStore.getState().navigationMsg).toMatchObject({
      txt: 'This cat was deleted',
      type: 'error',
    })
  })

  // The viewer's own delete: its redirect and "Cat deleted" own that exit
  it("doesn't redirect while the page's own delete is in flight", () => {
    const { rerender } = renderChat()
    useUserMsgStore.getState().queueSuccessNavigationMsg('Cat deleted')

    rerender({ catId: CAT_ID, isOpen: false, isCatDeleting: true })
    act(() => serverEmit('cat:removed', { catId: CAT_ID }))

    expect(navigate).not.toHaveBeenCalled()
    expect(useUserMsgStore.getState().navigationMsg).toMatchObject({ txt: 'Cat deleted' })
  })

  // The socket is app-wide: a late event from a room just left can still land here
  it("ignores another cat's removal", () => {
    renderChat()

    act(() => serverEmit('cat:removed', { catId: OTHER_CAT_ID }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const { unmount } = renderChat()

    unmount()
    act(() => serverEmit('cat:removed', { catId: CAT_ID }))

    expect(navigate).not.toHaveBeenCalled()
  })
})
