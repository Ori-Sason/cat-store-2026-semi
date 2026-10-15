import jwt from 'jsonwebtoken'
import type { LoggedInUser } from '@cat-store/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '../api/auth/auth.service.ts'
import { config } from '../config/index.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService, type AlsStore } from './als.service.ts'
import { createFakeSocket } from '../test/fake-socket.helper.ts'
import { startSocketServer } from '../test/socket-server.helper.ts'
import { socketService } from './socket.service.ts'

const LOGGED_IN_USER: LoggedInUser = {
  _id: '652f1c2e9b1e8a3d4c5b6a79',
  username: 'mitzi',
  fullname: 'Mitzi',
  isAdmin: false,
}

// What the handshake left on the server side of the client's socket
async function _serverSocketDataFor(clientId: string | undefined) {
  const serverSockets = await socketService.getIo().fetchSockets()
  return serverSockets.find(({ id }) => id === clientId)?.data
}

describe('socketService.emit', () => {
  // REST controllers emit through it, and Supertest runs them with no io
  it('does nothing before setup, instead of throwing', () => {
    expect(() => socketService.emit('anything', {})).not.toThrow()
  })

  // close() must reset the holder: one left pointing at a closed io would skip the no-op path
  it('goes back to the no-op path after close', async () => {
    const server = await startSocketServer()
    await server.close()

    expect(() => socketService.getIo()).toThrow('No io')
    expect(() => socketService.emit('anything', {})).not.toThrow()
  })
})

describe('socketService handshake', () => {
  let server: Awaited<ReturnType<typeof startSocketServer>>

  beforeAll(async () => {
    server = await startSocketServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('connects a guest with no token user', async () => {
    const client = await server.connectClient()

    expect(await _serverSocketDataFor(client.id)).toEqual({ tokenUser: null, tokenExp: null })
  })

  it('sets the token user and exp from the loginToken cookie, with no DB read', async () => {
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    const { exp } = authService.verifyLoginTokenWithExp(loginToken)!
    const client = await server.connectClient(`loginToken=${loginToken}`)

    expect(await _serverSocketDataFor(client.id)).toEqual({
      tokenUser: LOGGED_IN_USER,
      tokenExp: exp,
    })
  })

  it('connects an expired token as a guest, not a rejected handshake', async () => {
    const expiredLoginToken = jwt.sign(
      { ...LOGGED_IN_USER, exp: Math.floor(Date.now() / 1000) - 60 },
      config.jwtSecret,
      { algorithm: 'HS256' },
    )
    const client = await server.connectClient(`loginToken=${expiredLoginToken}`)

    expect(client.connected).toBe(true)
    expect(await _serverSocketDataFor(client.id)).toEqual({ tokenUser: null, tokenExp: null })
  })

  // The handshake arrives on the WebSocket upgrade then, not a polling GET. engine.use must
  // parse the cookie there too
  it('reads the cookie on a WebSocket-only connection', async () => {
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    const client = await server.connectClient(`loginToken=${loginToken}`, {
      transports: ['websocket'],
    })

    expect((await _serverSocketDataFor(client.id))?.tokenUser).toEqual(LOGGED_IN_USER)
  })
})

describe('socketService.on', () => {
  const EVENT = 'test:event'

  beforeEach(() => {
    // on() logs every error - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("runs the chain in order and acks with the last step's return value", async () => {
    const calls: string[] = []
    const { socket, emit } = createFakeSocket()
    socketService.on(
      socket,
      EVENT,
      () => {
        calls.push('check')
      },
      ({ payload }) => {
        calls.push('controller')
        return { echo: payload }
      },
    )
    const ack = vi.fn()

    await emit(EVENT, { a: 1 }, ack)

    expect(calls).toEqual(['check', 'controller'])
    expect(ack).toHaveBeenCalledExactlyOnceWith({ echo: { a: 1 } })
  })

  it('acks {} when the chain returns nothing', async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(socket, EVENT, () => {})
    const ack = vi.fn()

    await emit(EVENT, {}, ack)

    expect(ack).toHaveBeenCalledExactlyOnceWith({})
  })

  it('passes a payload a step replaced on to the next step', async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(
      socket,
      EVENT,
      (event) => {
        event.payload = 'parsed'
      },
      ({ payload }) => payload,
    )
    const ack = vi.fn()

    await emit(EVENT, 'raw', ack)

    expect(ack).toHaveBeenCalledWith('parsed')
  })

  it('runs each event in its own ALS store, with the socket id and token user', async () => {
    const tokenUser = { ...LOGGED_IN_USER }
    const { socket, emit } = createFakeSocket({ tokenUser })
    const stores: AlsStore[] = []
    socketService.on(socket, EVENT, () => {
      stores.push({ ...alsService.getStore() })
    })

    await emit(EVENT, {})
    await emit(EVENT, {})

    expect(stores[0]).toMatchObject({ socketId: 'fake-socket-id', tokenUser, verifiedUser: null })
    expect(stores[0]!.requestId).not.toBe(stores[1]!.requestId)
  })

  it('stops the chain at a thrown HttpError and acks it as { error }, with the requestId', async () => {
    const { socket, emit } = createFakeSocket()
    const controller = vi.fn()
    socketService.on(
      socket,
      EVENT,
      () => {
        throw new HttpError(403, 'FORBIDDEN', 'Not in the room')
      },
      controller,
    )
    const ack = vi.fn()

    await emit(EVENT, {}, ack)

    expect(controller).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledExactlyOnceWith({
      error: { code: 'FORBIDDEN', message: 'Not in the room', requestId: expect.any(String) },
    })
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[ws socket=fake-socket-id\] test:event -> 403 FORBIDDEN: Not in the room/,
      ),
    )
  })

  it('acks an unexpected error as INTERNAL and logs its stack', async () => {
    const { socket, emit } = createFakeSocket()
    const crash = new Error('Mongo exploded')
    socketService.on(socket, EVENT, async () => {
      throw crash
    })
    const ack = vi.fn()

    await emit(EVENT, {}, ack)

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'INTERNAL' }) })
    expect(console.error).toHaveBeenCalledWith(crash)
  })

  // Anyone can emit with no ack from devtools. Calling the missing ack would throw inside the
  // error path, an unhandled rejection that crashes Node
  it('answers nothing and still logs when the client sent no ack', async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(socket, EVENT, () => {
      throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this')
    })

    await expect(emit(EVENT, {})).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalledOnce()
  })

  // socket.emit(name, cb) puts the callback where the payload goes
  it('takes a lone callback as the ack, with no payload', async () => {
    const { socket, emit } = createFakeSocket()
    const payloads: unknown[] = []
    socketService.on(socket, EVENT, ({ payload }) => {
      payloads.push(payload)
      return { ok: true }
    })
    const ack = vi.fn()

    await emit(EVENT, ack)

    expect(payloads).toEqual([undefined])
    expect(ack).toHaveBeenCalledWith({ ok: true })
  })

  it("doesn't throw when the ack itself throws", async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(socket, EVENT, () => {
      throw new HttpError(403, 'FORBIDDEN', 'No')
    })
    const ack = vi.fn(() => {
      throw new Error('ack exploded')
    })

    await expect(emit(EVENT, {}, ack)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to answer'),
      expect.any(Error),
    )
  })
})
