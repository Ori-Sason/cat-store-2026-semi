import type { LoggedInUser } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socketService } from '../../services/socket/socket.service.ts'
import { createFakeSocket } from '../../test/fake-socket.helper.ts'
import { requireTokenUser } from './require-token-user.socket-middleware.ts'

const EVENT = 'test:event'
const TOKEN_USER: LoggedInUser = {
  _id: '652f1c2e9b1e8a3d4c5b6a79',
  username: 'mitzi',
  fullname: 'Mitzi',
  isAdmin: false,
}

function _nowSec() {
  return Math.floor(Date.now() / 1000)
}

// Binds requireTokenUser before a step that acks { ok: true }, then emits once
async function _emitWith(socketData: Parameters<typeof createFakeSocket>[0]) {
  const { socket, emit } = createFakeSocket(socketData)
  socketService.on(socket, EVENT, requireTokenUser, () => ({ ok: true }))
  const ack = vi.fn()
  await emit(EVENT, {}, ack)
  return ack
}

describe('requireTokenUser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lets a token user through', async () => {
    const ack = await _emitWith({ tokenUser: TOKEN_USER, tokenExp: _nowSec() + 60 })

    expect(ack).toHaveBeenCalledWith({ ok: true })
  })

  it('rejects a guest with UNAUTHORIZED', async () => {
    const ack = await _emitWith({})

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  // The handshake saw a valid token, but the socket stayed open past its exp
  it('rejects a token that expired after the handshake', async () => {
    const ack = await _emitWith({ tokenUser: TOKEN_USER, tokenExp: _nowSec() - 1 })

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })
})
