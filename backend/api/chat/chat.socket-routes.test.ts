import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import type { Socket as ClientSocket } from 'socket.io-client'
import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MSG_ADD,
  CHAT_MSG_ADDED,
  type ChatMsg,
} from '@cat-store/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc } from '../../models/chat.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { socketService } from '../../services/socket.service.ts'
import { startSocketServer } from '../../test/socket-server.helper.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { authService } from '../auth/auth.service.ts'
import { catService } from '../cat/cat.service.ts'

setupTestDb()

// A fresh cat per test: sockets from earlier tests stay connected (the helper closes them in
// afterAll), so a shared room would still hold them
function _buildCat(): CatDoc {
  return {
    _id: new ObjectId(),
    ownerId: new ObjectId(),
    name: 'Mitzi',
    price: 100,
    labels: ['Calm'],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
  }
}

function _buildUser(username: string, isAdmin: boolean): UserDoc {
  return {
    _id: new ObjectId(),
    username,
    fullname: `${username} fullname`,
    password: 'hash',
    isAdmin,
    createdAt: 1,
    updatedAt: 1,
  }
}

const MAYA = _buildUser('maya', false)
const NOAM = _buildUser('noam', false)

// A signed loginToken cookie, the same one login sets
function _loginCookie({ _id, username, fullname, isAdmin }: UserDoc): string {
  const loggedInUser = { _id: _id.toHexString(), username, fullname, isAdmin }
  return `loginToken=${authService.createLoginToken(loggedInUser, false)}`
}

let cat: CatDoc
let catId: string
let catRoom: string

let server: Awaited<ReturnType<typeof startSocketServer>>

beforeAll(async () => {
  server = await startSocketServer()
})

afterAll(async () => {
  await server.close()
})

beforeEach(async () => {
  cat = _buildCat()
  catId = cat._id.toHexString()
  catRoom = socketService.getCatRoomName(catId)
  const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  await cats.insertOne(cat)
  const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  await users.insertMany([MAYA, NOAM])
  // 4xx are logged as warnings by on() - keep test output clean
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// The ids of the sockets in a room, read on the server
async function _socketIdsIn(room: string): Promise<string[]> {
  const sockets = await socketService.getIo().in(room).fetchSockets()
  return sockets.map(({ id }) => id)
}

// A logged-in client already in the cat's room
async function _joinedClient(user: UserDoc): Promise<ClientSocket> {
  const client = await server.connectClient(_loginCookie(user))
  await client.emitWithAck(CHAT_JOIN, { catId })
  return client
}

// Every chat:msg-added the client gets from here on
function _collectAdded(client: ClientSocket): ChatMsg[] {
  const msgs: ChatMsg[] = []
  client.on(CHAT_MSG_ADDED, ({ msg }: { msg: ChatMsg }) => msgs.push(msg))
  return msgs
}

// A round trip on the client's own connection. The server writes a broadcast to a socket before
// any later ack on it, so after this, every broadcast already sent to the client has arrived
async function _flush(client: ClientSocket): Promise<void> {
  await client.emitWithAck(CHAT_JOIN, { catId })
}

describe('chat:join', () => {
  it("acks {} and puts a guest's socket in the cat's room", async () => {
    const client = await server.connectClient()

    const ack = await client.emitWithAck(CHAT_JOIN, { catId })

    expect(ack).toEqual({})
    expect(await _socketIdsIn(catRoom)).toEqual([client.id])
  })

  it('acks CAT_NOT_FOUND for an unknown cat, and joins no room', async () => {
    const client = await server.connectClient()
    const unknownCatId = new ObjectId().toHexString()

    const ack = await client.emitWithAck(CHAT_JOIN, { catId: unknownCatId })

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'CAT_NOT_FOUND' }) })
    expect(await _socketIdsIn(socketService.getCatRoomName(unknownCatId))).toEqual([])
  })

  it('acks VALIDATION_FAILED for a malformed catId', async () => {
    const client = await server.connectClient()

    const ack = await client.emitWithAck(CHAT_JOIN, { catId: 'nope' })

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'VALIDATION_FAILED' }) })
  })

  // Room names compare as strings: cat:ABC… and cat:abc… would be two rooms, and broadcasts
  // go to the lowercase one
  it('puts an uppercase catId in the same room as the lowercase one', async () => {
    const lower = await server.connectClient()
    const upper = await server.connectClient()

    await lower.emitWithAck(CHAT_JOIN, { catId })
    await upper.emitWithAck(CHAT_JOIN, { catId: catId.toUpperCase() })

    expect((await _socketIdsIn(catRoom)).sort()).toEqual([lower.id, upper.id].sort())
  })

  it('is idempotent: StrictMode join → leave → join ends joined', async () => {
    const client = await server.connectClient()

    await client.emitWithAck(CHAT_JOIN, { catId })
    client.emit(CHAT_LEAVE, { catId })
    await client.emitWithAck(CHAT_JOIN, { catId })

    expect(await _socketIdsIn(catRoom)).toEqual([client.id])
  })

  // A fast cat switch: leave A runs while join A is still reading the cat. Without wantedCatIds,
  // join A would finish and put the socket in room A for good
  it('leaves the socket out of the room when a leave lands during the cat read', async () => {
    const client = await server.connectClient()
    const { promise: catRead, resolve: finishCatRead } = Promise.withResolvers<CatDoc>()
    const getById = vi.spyOn(catService, 'getById').mockReturnValueOnce(catRead)

    const joinAck = client.emitWithAck(CHAT_JOIN, { catId })
    await vi.waitFor(() => expect(getById).toHaveBeenCalled())
    // With an ack, so the test knows the server handled it
    await client.emitWithAck(CHAT_LEAVE, { catId })
    finishCatRead(cat)

    expect(await joinAck).toEqual({})
    expect(await _socketIdsIn(catRoom)).toEqual([])
  })
})

describe('chat:leave', () => {
  it("takes the socket out of the cat's room", async () => {
    const client = await server.connectClient()
    await client.emitWithAck(CHAT_JOIN, { catId })

    await client.emitWithAck(CHAT_LEAVE, { catId })

    expect(await _socketIdsIn(catRoom)).toEqual([])
  })

  it('leaves the same room for an uppercase catId', async () => {
    const client = await server.connectClient()
    await client.emitWithAck(CHAT_JOIN, { catId })

    await client.emitWithAck(CHAT_LEAVE, { catId: catId.toUpperCase() })

    expect(await _socketIdsIn(catRoom)).toEqual([])
  })
})

describe('chat:msg-add', () => {
  function _payload(text = 'Is she still available?') {
    return { catId, clientMsgId: randomUUID(), text }
  }

  it('saves the msg, acks it, and broadcasts it to the room, the sender included', async () => {
    const sender = await _joinedClient(MAYA)
    const other = await _joinedClient(NOAM)
    const senderAdded = _collectAdded(sender)
    const otherAdded = _collectAdded(other)
    const payload = _payload('  Is she still available?  ')

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, payload)
    await _flush(sender)
    await _flush(other)

    const expected: ChatMsg = {
      _id: expect.any(String),
      catId,
      clientMsgId: payload.clientMsgId,
      text: 'Is she still available?',
      isDeleted: false,
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      user: { _id: MAYA._id.toHexString(), fullname: MAYA.fullname, isAdmin: false },
    }
    expect(ack).toEqual({ msg: expected })
    expect(senderAdded).toEqual([ack.msg])
    expect(otherAdded).toEqual([ack.msg])
    const chatMsgs = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    expect(await chatMsgs.countDocuments({ catId: cat._id, userId: MAYA._id })).toBe(1)
  })

  // username is half a login: the handshake user has it, the wire never does
  it('sends no username, in the ack or the broadcast', async () => {
    const sender = await _joinedClient(MAYA)
    const added = _collectAdded(sender)

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, _payload())
    await _flush(sender)

    expect(ack.msg.user).not.toHaveProperty('username')
    expect(added[0]!.user).not.toHaveProperty('username')
  })

  // The ack was lost, so the client retries with the same clientMsgId
  it('acks a retry with the saved msg, saves nothing new and broadcasts nothing new', async () => {
    const sender = await _joinedClient(MAYA)
    const other = await _joinedClient(NOAM)
    const otherAdded = _collectAdded(other)
    const payload = _payload()

    const first = await sender.emitWithAck(CHAT_MSG_ADD, payload)
    const retry = await sender.emitWithAck(CHAT_MSG_ADD, payload)
    await _flush(other)

    expect(retry).toEqual(first)
    expect(otherAdded).toHaveLength(1)
    const chatMsgs = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    expect(await chatMsgs.countDocuments({ clientMsgId: payload.clientMsgId })).toBe(1)
  })

  // Scoped per user: one user can't block another user's id
  it("saves another user's msg with the same clientMsgId", async () => {
    const maya = await _joinedClient(MAYA)
    const noam = await _joinedClient(NOAM)
    const payload = _payload()

    const mayaAck = await maya.emitWithAck(CHAT_MSG_ADD, payload)
    const noamAck = await noam.emitWithAck(CHAT_MSG_ADD, payload)

    expect(noamAck.msg._id).not.toBe(mayaAck.msg._id)
    expect(noamAck.msg.user._id).toBe(NOAM._id.toHexString())
  })

  it('rejects a guest with UNAUTHORIZED, even in the room', async () => {
    const guest = await server.connectClient()
    await guest.emitWithAck(CHAT_JOIN, { catId })

    const ack = await guest.emitWithAck(CHAT_MSG_ADD, _payload())

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  // Auth runs before membership, like REST
  it('rejects a guest outside the room with UNAUTHORIZED, not FORBIDDEN', async () => {
    const guest = await server.connectClient()

    const ack = await guest.emitWithAck(CHAT_MSG_ADD, _payload())

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  it('rejects a token that expired after the handshake with UNAUTHORIZED', async () => {
    const sender = await _joinedClient(MAYA)
    // The socket outlived its token. Not with fake timers: a Date jump makes the client's
    // heartbeat think the connection is dead. fetchSockets hands back this socket's own data
    const [serverSocket] = await socketService.getIo().in(catRoom).fetchSockets()
    serverSocket!.data.tokenExp = Math.floor(Date.now() / 1000) - 1

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, _payload())

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  it('rejects a user deleted since the handshake with UNAUTHORIZED', async () => {
    const sender = await _joinedClient(MAYA)
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.deleteOne({ _id: MAYA._id })

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, _payload())

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) })
  })

  it('rejects a user who never joined the room with FORBIDDEN', async () => {
    const sender = await server.connectClient(_loginCookie(MAYA))

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, _payload())

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
  })

  it('rejects a bad payload with VALIDATION_FAILED, and saves nothing', async () => {
    const sender = await _joinedClient(MAYA)

    const ack = await sender.emitWithAck(CHAT_MSG_ADD, { ..._payload(), text: '   ' })

    expect(ack).toEqual({ error: expect.objectContaining({ code: 'VALIDATION_FAILED' }) })
    const chatMsgs = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    expect(await chatMsgs.countDocuments()).toBe(0)
  })
})
