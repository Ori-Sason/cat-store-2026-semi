import jwt from 'jsonwebtoken'
import type { LoggedInUser } from '@cat-store/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authService } from '../../api/auth/auth.service.ts'
import { config } from '../../config/index.ts'
import { startSocketServer } from '../../test/socket-server.helper.ts'
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

describe('socketSetupService.close', () => {
  // close() must reset the holder: one left pointing at a closed io would skip the no-op path
  it('goes back to the no-op path after close', async () => {
    const server = await startSocketServer()
    await server.close()

    expect(() => socketService.getIo()).toThrow('No io')
    expect(() => socketService.emit('anything', {})).not.toThrow()
  })
})

describe('socketSetupService handshake', () => {
  let server: Awaited<ReturnType<typeof startSocketServer>>

  beforeAll(async () => {
    server = await startSocketServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('connects a guest with no token user', async () => {
    const client = await server.connectClient()

    expect(await _serverSocketDataFor(client.id)).toEqual({
      tokenUser: null,
      tokenExp: null,
      wantedCatIds: new Set(),
    })
  })

  it('sets the token user and exp from the loginToken cookie', async () => {
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    const { exp } = authService.verifyLoginTokenWithExp(loginToken)!
    const client = await server.connectClient(`loginToken=${loginToken}`)

    expect(await _serverSocketDataFor(client.id)).toEqual({
      tokenUser: LOGGED_IN_USER,
      tokenExp: exp,
      wantedCatIds: new Set(),
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
    expect(await _serverSocketDataFor(client.id)).toEqual({
      tokenUser: null,
      tokenExp: null,
      wantedCatIds: new Set(),
    })
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
