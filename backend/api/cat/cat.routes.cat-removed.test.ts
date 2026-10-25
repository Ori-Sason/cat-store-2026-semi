import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import type { Socket as ClientSocket } from 'socket.io-client'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAT_REMOVED, CHAT_JOIN, CHAT_MSG_ADD, type CatRemoved } from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc } from '../../models/chat.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { socketService } from '../../services/socket/socket.service.ts'
import { startSocketServer } from '../../test/socket-server.helper.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { authService } from '../auth/auth.service.ts'
import { catService } from './cat.service.ts'

// DELETE /api/cats/:id with a live io, apart from cat.routes.test.ts, which runs with none

setupTestDb()

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

const CAT_OWNER = _buildUser('cat_owner', false)
const VIEWER = _buildUser('viewer', false)

// A fresh cat per test: sockets from earlier tests stay connected (the helper closes them in
// afterAll), so a shared room would still hold them
function _buildCat(): CatDoc {
  return {
    _id: new ObjectId(),
    ownerId: CAT_OWNER._id,
    name: 'Mitzi',
    price: 100,
    labels: ['Calm'],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
  }
}

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
  await users.insertMany([CAT_OWNER, VIEWER])
  // 4xx are logged as warnings - keep test output clean
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// A client in the cat's room that records every cat:removed from here on. No cookie → a guest
async function _viewer(user?: UserDoc) {
  const client = await server.connectClient(user && _loginCookie(user))
  await client.emitWithAck(CHAT_JOIN, { catId })
  const removedEvents: CatRemoved[] = []
  client.on(CAT_REMOVED, (event: CatRemoved) => removedEvents.push(event))
  return { client, removedEvents }
}

// Waits until every event the server already sent this client has arrived. A join of an unknown
// cat acks CAT_NOT_FOUND and joins nothing, so unlike a join of catId it never puts the client
// back in a room the delete emptied
async function _flush(client: ClientSocket): Promise<void> {
  await client.emitWithAck(CHAT_JOIN, { catId: new ObjectId().toHexString() })
}

async function _socketIdsIn(room: string): Promise<string[]> {
  const sockets = await socketService.getIo().in(room).fetchSockets()
  return sockets.map(({ id }) => id)
}

function _deleteCat(id: string, user?: UserDoc) {
  const req = request(app).delete(`/api/cats/${id}`)
  return user ? req.set('Cookie', _loginCookie(user)) : req
}

describe('DELETE /api/cats/:id → cat:removed', () => {
  it("tells a logged-in viewer and empties the room, so the viewer's later send saves nothing", async () => {
    const viewer = await _viewer(VIEWER)

    const res = await _deleteCat(catId, CAT_OWNER)
    await _flush(viewer.client)

    expect(res.status).toBe(204)
    expect(viewer.removedEvents).toEqual([{ catId }])
    expect(await _socketIdsIn(catRoom)).toEqual([])
    const ack = await viewer.client.emitWithAck(CHAT_MSG_ADD, {
      catId,
      clientMsgId: randomUUID(),
      text: 'Is she still available?',
    })
    expect(ack).toEqual({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    const chatMsgs = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    expect(await chatMsgs.countDocuments()).toBe(0)
  })

  it('tells a guest viewer too', async () => {
    const guest = await _viewer()

    await _deleteCat(catId, CAT_OWNER)
    await _flush(guest.client)

    expect(guest.removedEvents).toEqual([{ catId }])
  })

  it('sends nothing on a guest delete (401), and the room keeps its sockets', async () => {
    const viewer = await _viewer(VIEWER)

    const res = await _deleteCat(catId)
    await _flush(viewer.client)

    expect(res.status).toBe(401)
    expect(viewer.removedEvents).toEqual([])
    expect(await _socketIdsIn(catRoom)).toEqual([viewer.client.id])
  })

  it("sends nothing on a non-owner's delete (403), and the room keeps its sockets", async () => {
    const viewer = await _viewer(VIEWER)

    const res = await _deleteCat(catId, VIEWER)
    await _flush(viewer.client)

    expect(res.status).toBe(403)
    expect(viewer.removedEvents).toEqual([])
    expect(await _socketIdsIn(catRoom)).toEqual([viewer.client.id])
  })

  // requireCatOwner reads the cat first, so an unknown id 404s before the controller. The case
  // that reaches remove's 404 is a race: another delete wins between the owner check and the
  // remove. The owner check is fed the cat here, while the DB no longer has it
  it('sends nothing when the remove finds the cat already gone (404)', async () => {
    const viewer = await _viewer(VIEWER)
    vi.spyOn(catService, 'getById').mockResolvedValueOnce(cat)
    const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await cats.deleteOne({ _id: cat._id })

    const res = await _deleteCat(catId, CAT_OWNER)
    await _flush(viewer.client)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
    expect(viewer.removedEvents).toEqual([])
  })

  it('reaches the lowercase room when the URL has the id uppercased', async () => {
    const viewer = await _viewer(VIEWER)

    const res = await _deleteCat(catId.toUpperCase(), CAT_OWNER)
    await _flush(viewer.client)

    expect(res.status).toBe(204)
    expect(viewer.removedEvents).toEqual([{ catId }])
  })
})
