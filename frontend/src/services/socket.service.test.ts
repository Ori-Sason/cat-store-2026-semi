import type { LoggedInUser } from '@cat-store/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { socketService } from './socket.service'

// A stand-in for the socket.io-client socket: only the calls the service makes
const fakeSocket = vi.hoisted(() => {
  const socket = {
    connect: vi.fn(() => socket),
    disconnect: vi.fn(() => socket),
  }
  return socket
})

vi.mock('socket.io-client', () => ({ io: () => fakeSocket }))

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

const _OTHER_USER = { ..._USER, _id: 'user-2', username: 'maya' } satisfies LoggedInUser

const store = () => useLoggedInUserStore.getState()

describe('socketService', () => {
  // connect() subscribes to the store, and main.tsx calls it once per app load
  beforeAll(() => {
    socketService.connect()
  })

  beforeEach(() => {
    useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
    vi.clearAllMocks()
  })

  it('reconnects on login', () => {
    store().setLoggedInUser(_USER)

    expect(fakeSocket.disconnect).toHaveBeenCalledOnce()
    expect(fakeSocket.connect).toHaveBeenCalledOnce()
  })

  it('reconnects on logout', () => {
    store().setLoggedInUser(_USER)
    vi.clearAllMocks()

    store().clearLoggedInUser()

    expect(fakeSocket.disconnect).toHaveBeenCalledOnce()
    expect(fakeSocket.connect).toHaveBeenCalledOnce()
  })

  it('reconnects when another user logs in', () => {
    store().setLoggedInUser(_USER)
    vi.clearAllMocks()

    store().setLoggedInUser(_OTHER_USER)

    expect(fakeSocket.disconnect).toHaveBeenCalledOnce()
    expect(fakeSocket.connect).toHaveBeenCalledOnce()
  })

  it('does not reconnect when the same user is set again', () => {
    store().setLoggedInUser(_USER)
    vi.clearAllMocks()

    store().setLoggedInUser({ ..._USER, fullname: 'Ori S.' })

    expect(fakeSocket.disconnect).not.toHaveBeenCalled()
    expect(fakeSocket.connect).not.toHaveBeenCalled()
  })

  it('does not reconnect when a guest is cleared again', () => {
    store().clearLoggedInUser()

    expect(fakeSocket.disconnect).not.toHaveBeenCalled()
    expect(fakeSocket.connect).not.toHaveBeenCalled()
  })
})
