import type { ChatPresence, UserRef } from '@cat-store/shared'
import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  CAT_ID,
  OTHER_CAT_ID,
  VIEWER,
  renderChat,
  serverEmit,
  setupChatTest,
  socketListeners,
} from './chat-test.helper'

vi.mock('../../../services/socket.service')
vi.mock('../../../services/chat.service')
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => vi.fn(),
}))

setupChatTest()

const VIEWER_REF: UserRef = { _id: VIEWER._id, fullname: VIEWER.fullname, isAdmin: false }
const NOAM: UserRef = { _id: 'user-2', fullname: 'Noam Cohen', isAdmin: false }

function _presence(users: UserRef[], catId = CAT_ID): ChatPresence {
  return { catId, count: users.length, users }
}

function _serverPresence(presence: ChatPresence) {
  act(() => serverEmit('chat:presence-changed', presence))
}

// Snapshots come with the join on page load, not with the first open, so a closed chat is enough
describe('useCatChat presence', () => {
  it('is null until the first snapshot', () => {
    const { result } = renderChat()
    expect(result.current.presence).toBeNull()
  })

  it('takes the snapshot the server sends', () => {
    const { result } = renderChat()
    const presence = _presence([VIEWER_REF, NOAM])

    _serverPresence(presence)

    expect(result.current.presence).toEqual(presence)
  })

  it('replaces the snapshot whole with the next one', () => {
    const { result } = renderChat()
    _serverPresence(_presence([VIEWER_REF, NOAM]))

    _serverPresence(_presence([VIEWER_REF]))

    expect(result.current.presence).toEqual(_presence([VIEWER_REF]))
  })

  // A guest's snapshot: the count only, never the names
  it('takes a guest snapshot with no names', () => {
    const { result } = renderChat()
    const presence: ChatPresence = { catId: CAT_ID, count: 2, users: null }

    _serverPresence(presence)

    expect(result.current.presence).toEqual(presence)
  })

  it('drops a snapshot for another cat', () => {
    const { result } = renderChat()
    _serverPresence(_presence([VIEWER_REF]))

    _serverPresence(_presence([NOAM], OTHER_CAT_ID))

    expect(result.current.presence).toEqual(_presence([VIEWER_REF]))
  })

  // Offline, nothing would correct the count. The rejoin on connect brings a fresh one
  it('clears on disconnect', () => {
    const { result } = renderChat()
    _serverPresence(_presence([VIEWER_REF, NOAM]))

    act(() => serverEmit('disconnect'))

    expect(result.current.presence).toBeNull()
  })

  it('removes its listeners on unmount', () => {
    const { unmount } = renderChat()

    unmount()

    expect(socketListeners.get('chat:presence-changed')?.size).toBe(0)
    expect(socketListeners.get('disconnect')?.size).toBe(0)
  })
})
