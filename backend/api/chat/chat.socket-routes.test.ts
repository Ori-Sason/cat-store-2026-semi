import { ObjectId } from 'mongodb'
import { CHAT_JOIN, CHAT_LEAVE } from '@cat-store/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { socketService } from '../../services/socket.service.ts'
import { startSocketServer } from '../../test/socket-server.helper.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
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

describe('chat:join', () => {
  it("acks {} and puts a guest's socket in the cat's room", async () => {
    const client = await server.connectClient()

    const ack = await client.emitWithAck(CHAT_JOIN, { catId: catId })

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

    await lower.emitWithAck(CHAT_JOIN, { catId: catId })
    await upper.emitWithAck(CHAT_JOIN, { catId: catId.toUpperCase() })

    expect((await _socketIdsIn(catRoom)).sort()).toEqual([lower.id, upper.id].sort())
  })

  it('is idempotent: StrictMode join → leave → join ends joined', async () => {
    const client = await server.connectClient()

    await client.emitWithAck(CHAT_JOIN, { catId: catId })
    client.emit(CHAT_LEAVE, { catId: catId })
    await client.emitWithAck(CHAT_JOIN, { catId: catId })

    expect(await _socketIdsIn(catRoom)).toEqual([client.id])
  })

  // A fast cat switch: leave A runs while join A is still reading the cat. Without wantedCatIds,
  // join A would finish and put the socket in room A for good
  it('leaves the socket out of the room when a leave lands during the cat read', async () => {
    const client = await server.connectClient()
    const { promise: catRead, resolve: finishCatRead } = Promise.withResolvers<CatDoc>()
    const getById = vi.spyOn(catService, 'getById').mockReturnValueOnce(catRead)

    const joinAck = client.emitWithAck(CHAT_JOIN, { catId: catId })
    await vi.waitFor(() => expect(getById).toHaveBeenCalled())
    // With an ack, so the test knows the server handled it
    await client.emitWithAck(CHAT_LEAVE, { catId: catId })
    finishCatRead(cat)

    expect(await joinAck).toEqual({})
    expect(await _socketIdsIn(catRoom)).toEqual([])
  })
})

describe('chat:leave', () => {
  it("takes the socket out of the cat's room", async () => {
    const client = await server.connectClient()
    await client.emitWithAck(CHAT_JOIN, { catId: catId })

    await client.emitWithAck(CHAT_LEAVE, { catId: catId })

    expect(await _socketIdsIn(catRoom)).toEqual([])
  })

  it('leaves the same room for an uppercase catId', async () => {
    const client = await server.connectClient()
    await client.emitWithAck(CHAT_JOIN, { catId: catId })

    await client.emitWithAck(CHAT_LEAVE, { catId: catId.toUpperCase() })

    expect(await _socketIdsIn(catRoom)).toEqual([])
  })
})
