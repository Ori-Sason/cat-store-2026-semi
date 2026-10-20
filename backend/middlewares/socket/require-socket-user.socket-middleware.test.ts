import { ObjectId } from 'mongodb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { alsService } from '../../services/als.service.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { socketService } from '../../services/socket/socket.service.ts'
import { createFakeSocket } from '../../test/fake-socket.helper.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { requireSocketUser } from './require-socket-user.socket-middleware.ts'

setupTestDb()

const EVENT = 'test:event'

const USER: UserDoc = {
  _id: new ObjectId(),
  username: 'mitzi',
  fullname: 'Mitzi',
  password: 'hash',
  isAdmin: false,
  createdAt: 1,
  updatedAt: 1,
}

// The handshake's view of USER, which can be stale: here it still says isAdmin: true
const STALE_TOKEN_USER = {
  _id: USER._id.toHexString(),
  username: USER.username,
  fullname: USER.fullname,
  isAdmin: true,
}

function _nowSec() {
  return Math.floor(Date.now() / 1000)
}

// The step after requireSocketUser acks what a controller would read: the verified user
async function _emitWith(socketData: Parameters<typeof createFakeSocket>[0]) {
  const { socket, emit } = createFakeSocket(socketData)
  socketService.on(socket, EVENT, requireSocketUser, () => alsService.getVerifiedUser())
  const ack = vi.fn()
  await emit(EVENT, {}, ack)
  return ack
}

describe('requireSocketUser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets the verified user from the DB, not from the stale token', async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.insertOne(USER)

    const ack = await _emitWith({ tokenUser: STALE_TOKEN_USER, tokenExp: _nowSec() + 60 })

    expect(ack).toHaveBeenCalledWith({ ...STALE_TOKEN_USER, isAdmin: false })
  })

  it('rejects a user deleted since the handshake with UNAUTHORIZED', async () => {
    const ack = await _emitWith({ tokenUser: STALE_TOKEN_USER, tokenExp: _nowSec() + 60 })

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  it('rejects a guest with UNAUTHORIZED', async () => {
    const ack = await _emitWith({})

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  it('rejects an expired token with UNAUTHORIZED, even for an existing user', async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.insertOne(USER)

    const ack = await _emitWith({ tokenUser: STALE_TOKEN_USER, tokenExp: _nowSec() - 1 })

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })
})
