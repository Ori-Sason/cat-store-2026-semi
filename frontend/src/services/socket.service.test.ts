import type { LoggedInUser } from '@cat-store/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { socketService } from './socket.service'

// A stand-in for the socket.io-client socket: only the calls the service makes
const fakeSocket = vi.hoisted(() => {
  const emitWithAck = vi.fn()
  const socket = {
    connect: vi.fn(() => socket),
    disconnect: vi.fn(() => socket),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    timeout: vi.fn(() => ({ emitWithAck })),
    emitWithAck,
    connected: false,
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

describe('socketService reconnect', () => {
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

describe('socketService.isConnected', () => {
  it("follows the socket's connected flag", () => {
    fakeSocket.connected = true
    expect(socketService.isConnected()).toBe(true)

    fakeSocket.connected = false
    expect(socketService.isConnected()).toBe(false)
  })
})

describe('socketService.emitWithAck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves with the ack, under a 5s timeout', async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ msg: 'saved' })

    expect(await socketService.emitWithAck('chat:join', { catId: 'cat-1' })).toEqual({
      msg: 'saved',
    })
    expect(fakeSocket.timeout).toHaveBeenCalledWith(5_000)
    expect(fakeSocket.emitWithAck).toHaveBeenCalledWith('chat:join', { catId: 'cat-1' })
  })

  it('throws an error ack as an ApiError with its code', async () => {
    fakeSocket.emitWithAck.mockResolvedValue({
      error: { code: 'CAT_NOT_FOUND', message: 'Cat not found', requestId: 'req-1' },
    })

    const err = await socketService.emitWithAck('chat:join', {}).catch((err: unknown) => err)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'CAT_NOT_FOUND', requestId: 'req-1' })
  })

  it('clears the logged-in user on an UNAUTHORIZED ack', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    fakeSocket.emitWithAck.mockResolvedValue({
      error: { code: 'UNAUTHORIZED', message: 'Log in first', requestId: 'req-1' },
    })

    await expect(socketService.emitWithAck('chat:msg-add', {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(store().loggedInUser).toBeNull()
  })

  it('keeps the logged-in user on another error ack', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    fakeSocket.emitWithAck.mockResolvedValue({
      error: { code: 'FORBIDDEN', message: 'Not allowed', requestId: 'req-1' },
    })

    await expect(socketService.emitWithAck('chat:msg-add', {})).rejects.toThrow(ApiError)
    expect(store().loggedInUser).toEqual(_USER)
  })

  it('keeps the logged-in user on a timeout', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    fakeSocket.emitWithAck.mockRejectedValue(new Error('operation has timed out'))

    await expect(socketService.emitWithAck('chat:msg-add', {})).rejects.toThrow(ApiError)
    expect(store().loggedInUser).toEqual(_USER)
  })

  it('throws a timeout as NETWORK_ERROR', async () => {
    fakeSocket.emitWithAck.mockRejectedValue(new Error('operation has timed out'))

    await expect(socketService.emitWithAck('chat:join', {})).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('throws an error ack that is not ours as UNKNOWN', async () => {
    fakeSocket.emitWithAck.mockResolvedValue({ error: 'boom' })

    await expect(socketService.emitWithAck('chat:join', {})).rejects.toMatchObject({
      code: 'UNKNOWN',
    })
  })
})
