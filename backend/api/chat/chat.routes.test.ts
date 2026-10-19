import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMsgWithRefs } from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc } from '../../models/chat.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'

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

function _buildCat(name: string): CatDoc {
  return {
    _id: new ObjectId(),
    ownerId: ADMIN._id,
    name,
    price: 100,
    labels: ['Calm'],
    isInStock: true,
    imgUrl: `https://example.com/${name}.jpg`,
    createdAt: 1,
    updatedAt: 1,
  }
}

const MAYA = _buildUser('maya', false)
const ADMIN = _buildUser('admin', true)
const GONE_USER_ID = new ObjectId() // an author whose account is gone: no user doc
const MITZI = _buildCat('Mitzi')
const TOM = _buildCat('Tom')

// `count` msgs on a cat, oldest first. new ObjectId() only goes up within a process, so _id order
// is the order they're built in
function _buildMsgs(cat: CatDoc, count: number, userId = MAYA._id): ChatMsgDoc[] {
  return Array.from({ length: count }, (_, idx) => ({
    _id: new ObjectId(),
    catId: cat._id,
    userId,
    clientMsgId: randomUUID(),
    text: `msg ${idx}`,
    isDeleted: false,
    createdAt: 1_000 + idx,
    updatedAt: 1_000 + idx,
  }))
}

async function _insertMsgs(msgs: ChatMsgDoc[]) {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  await collection.insertMany(msgs)
}

function _ids(msgs: { _id: ObjectId | string }[]): string[] {
  return msgs.map(({ _id }) => _id.toString())
}

function _url(catId: string, query = '') {
  return `/api/cats/${catId}/chat-msgs${query}`
}

describe('GET /api/cats/:id/chat-msgs', () => {
  beforeEach(async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.insertMany([MAYA, ADMIN])
    const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await cats.insertMany([MITZI, TOM])
    // 4xx are logged as warnings by the error handler - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the newest 50, oldest first, with a cursor to the older ones', async () => {
    const msgs = _buildMsgs(MITZI, 55)
    await _insertMsgs(msgs)

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(res.status).toBe(200)
    expect(_ids(res.body.msgs)).toEqual(_ids(msgs.slice(5)))
    expect(res.body.nextBeforeId).toBe(msgs[5]!._id.toHexString())
  })

  it("returns only this cat's msgs", async () => {
    const mitziMsgs = _buildMsgs(MITZI, 2)
    await _insertMsgs([...mitziMsgs, ..._buildMsgs(TOM, 2)])

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(_ids(res.body.msgs)).toEqual(_ids(mitziMsgs))
  })

  it('sends a msg as ChatMsgWithRefs: string ids, the slim author, no userId or username', async () => {
    const [msg] = _buildMsgs(MITZI, 1, ADMIN._id)
    await _insertMsgs([msg!])

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    const expected: ChatMsgWithRefs = {
      _id: msg!._id.toHexString(),
      catId: MITZI._id.toHexString(),
      clientMsgId: msg!.clientMsgId,
      text: msg!.text,
      isDeleted: false,
      createdAt: msg!.createdAt,
      updatedAt: msg!.updatedAt,
      user: { _id: ADMIN._id.toHexString(), fullname: ADMIN.fullname, isAdmin: true },
    }
    expect(res.body).toEqual({ msgs: [expected], nextBeforeId: null })
  })

  it('returns exactly 50 with no cursor, since nothing older exists', async () => {
    await _insertMsgs(_buildMsgs(MITZI, 50))

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(res.body.msgs).toHaveLength(50)
    expect(res.body.nextBeforeId).toBeNull()
  })

  it('returns an empty page for a cat with no msgs', async () => {
    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ msgs: [], nextBeforeId: null })
  })

  it('pages back with beforeId until the cursor is null', async () => {
    const msgs = _buildMsgs(MITZI, 120)
    await _insertMsgs(msgs)

    const first = await request(app).get(_url(MITZI._id.toHexString()))
    const second = await request(app).get(
      _url(MITZI._id.toHexString(), `?beforeId=${first.body.nextBeforeId}`),
    )
    const third = await request(app).get(
      _url(MITZI._id.toHexString(), `?beforeId=${second.body.nextBeforeId}`),
    )

    expect(_ids(second.body.msgs)).toEqual(_ids(msgs.slice(20, 70)))
    expect(_ids(third.body.msgs)).toEqual(_ids(msgs.slice(0, 20)))
    expect(third.body.nextBeforeId).toBeNull()
  })

  it('pages forward with afterId (the gap fill), oldest first', async () => {
    const msgs = _buildMsgs(MITZI, 60)
    await _insertMsgs(msgs)

    const first = await request(app).get(
      _url(MITZI._id.toHexString(), `?afterId=${msgs[4]!._id.toHexString()}`),
    )
    const second = await request(app).get(
      _url(MITZI._id.toHexString(), `?afterId=${first.body.nextAfterId}`),
    )

    expect(_ids(first.body.msgs)).toEqual(_ids(msgs.slice(5, 55)))
    expect(first.body.nextAfterId).toBe(msgs[54]!._id.toHexString())
    expect(_ids(second.body.msgs)).toEqual(_ids(msgs.slice(55)))
    expect(second.body.nextAfterId).toBeNull()
  })

  it('accepts an uppercase cursor, like the cat id', async () => {
    const msgs = _buildMsgs(MITZI, 3)
    await _insertMsgs(msgs)

    const res = await request(app).get(
      _url(
        MITZI._id.toHexString().toUpperCase(),
        `?beforeId=${msgs[2]!._id.toHexString().toUpperCase()}`,
      ),
    )

    expect(res.status).toBe(200)
    expect(_ids(res.body.msgs)).toEqual(_ids(msgs.slice(0, 2)))
  })

  it('sends a deleted msg as a tombstone, with no text', async () => {
    const [msg] = _buildMsgs(MITZI, 1)
    await _insertMsgs([{ ...msg!, isDeleted: true, text: 'the secret stays in the DB' }])

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(res.body.msgs[0]).toMatchObject({ _id: msg!._id.toHexString(), isDeleted: true })
    expect(res.body.msgs[0]).not.toHaveProperty('text')
  })

  // A left join: an inner join would drop the row, leave replies without context, and break
  // the "is there more" check on the fetched 51
  it("keeps a gone author's msg with user: null, and the page stays full", async () => {
    const msgs = [..._buildMsgs(MITZI, 1, GONE_USER_ID), ..._buildMsgs(MITZI, 50)]
    await _insertMsgs(msgs)

    const res = await request(app).get(_url(MITZI._id.toHexString()))

    expect(res.body.msgs).toHaveLength(50)
    expect(res.body.nextBeforeId).toBe(msgs[1]!._id.toHexString())

    const older = await request(app).get(
      _url(MITZI._id.toHexString(), `?beforeId=${res.body.nextBeforeId}`),
    )
    expect(older.body.msgs).toEqual([
      expect.objectContaining({ _id: msgs[0]!._id.toHexString(), user: null }),
    ])
  })

  it('rejects beforeId and afterId together with 400 VALIDATION_FAILED', async () => {
    const id = new ObjectId().toHexString()

    const res = await request(app).get(
      _url(MITZI._id.toHexString(), `?beforeId=${id}&afterId=${id}`),
    )

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })

  it('rejects a malformed cursor with 400', async () => {
    const res = await request(app).get(_url(MITZI._id.toHexString(), '?beforeId=nope'))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
  })

  it.each([
    ['an unknown cat', new ObjectId().toHexString()],
    ['a malformed cat id', 'nope'],
  ])('returns 404 CAT_NOT_FOUND for %s', async (_, catId) => {
    const res = await request(app).get(_url(catId))

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('CAT_NOT_FOUND')
  })
})
