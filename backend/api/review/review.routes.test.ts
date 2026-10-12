import { Collection, ObjectId, type Document } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Review, ReviewContentInput, ReviewInput, ReviewWithRefs } from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { REVIEW_COLLECTION, type ReviewDoc } from '../../models/review.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { authService } from '../auth/auth.service.ts'

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

function _buildReview(user: UserDoc, cat: CatDoc, createdAt: number): ReviewDoc {
  return {
    _id: new ObjectId(),
    userId: user._id,
    catId: cat._id,
    content: `${user.username} on ${cat.name}`,
    createdAt,
    updatedAt: createdAt + 1,
  }
}

const MAYA = _buildUser('maya', false)
const NOAM = _buildUser('noam', false) // never writes a review here: the non-author
const ADMIN = _buildUser('admin', true)
const MITZI = _buildCat('Mitzi')
const TOM = _buildCat('Tom')

// Inserted out of order, so a passing test proves the sort
const MAYA_ON_MITZI = _buildReview(MAYA, MITZI, 1_000)
const ADMIN_ON_MITZI = _buildReview(ADMIN, MITZI, 3_000)
const MAYA_ON_TOM = _buildReview(MAYA, TOM, 2_000)

// The review as the API sends it: the exact keys, so a projection bug (an extra field, a leaked
// password / username, a leftover userId / catId) fails toEqual. ADMIN's reviews pin isAdmin true
function _toJson(review: ReviewDoc): ReviewWithRefs {
  const user = [MAYA, ADMIN].find(({ _id }) => _id.equals(review.userId))!
  const cat = [MITZI, TOM].find(({ _id }) => _id.equals(review.catId))!
  return {
    _id: review._id.toHexString(),
    content: review.content,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: { _id: user._id.toHexString(), fullname: user.fullname, isAdmin: user.isAdmin },
    cat: {
      _id: cat._id.toHexString(),
      name: cat.name,
      imgUrl: cat.imgUrl,
      ownerId: cat.ownerId.toHexString(),
    },
  }
}

// A signed loginToken cookie, the same one login sets
function _loginCookie({ _id, username, fullname, isAdmin }: UserDoc): string {
  const loggedInUser = { _id: _id.toHexString(), username, fullname, isAdmin }
  return `loginToken=${authService.createLoginToken(loggedInUser, false)}`
}

describe('GET /api/reviews', () => {
  beforeEach(async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.insertMany([MAYA, ADMIN])
    const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await cats.insertMany([MITZI, TOM])
    const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
    await reviews.insertMany([MAYA_ON_MITZI, MAYA_ON_TOM, ADMIN_ON_MITZI])
    // 400s are logged as warnings by the error handler - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a cat's reviews, newest first, joined with a slim author and cat", async () => {
    const res = await request(app).get(`/api/reviews?catId=${MITZI._id.toHexString()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([_toJson(ADMIN_ON_MITZI), _toJson(MAYA_ON_MITZI)])
  })

  it("returns a user's reviews across cats, newest first", async () => {
    const res = await request(app).get(`/api/reviews?userId=${MAYA._id.toHexString()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([_toJson(MAYA_ON_TOM), _toJson(MAYA_ON_MITZI)])
  })

  it('ANDs catId and userId', async () => {
    const res = await request(app).get(
      `/api/reviews?catId=${MITZI._id.toHexString()}&userId=${MAYA._id.toHexString()}`,
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual([_toJson(MAYA_ON_MITZI)])
  })

  // Belt and braces next to the exact toEqual above: the one thing that must never leak
  // isAdmin is public on purpose (the Admin chip), the login fields are not
  it('never sends the password or username of an author', async () => {
    const res = await request(app).get(`/api/reviews?catId=${MITZI._id.toHexString()}`)

    for (const review of res.body as ReviewWithRefs[]) {
      expect(review.user).not.toHaveProperty('password')
      expect(review.user).not.toHaveProperty('username')
    }
  })

  it('returns 200 [] for a cat with no reviews, not 404', async () => {
    const res = await request(app).get(`/api/reviews?catId=${new ObjectId().toHexString()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  // $unwind is an inner join. A deleted user or cat can leave reviews behind (there's no
  // transaction around the two deletes) - this keeps those orphans hidden
  it('drops a review whose author or cat no longer exists', async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.deleteOne({ _id: ADMIN._id })
    const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await cats.deleteOne({ _id: TOM._id })

    const res = await request(app).get(`/api/reviews?userId=${MAYA._id.toHexString()}`)
    const resByCat = await request(app).get(`/api/reviews?catId=${MITZI._id.toHexString()}`)

    expect(res.body).toEqual([_toJson(MAYA_ON_MITZI)])
    expect(resByCat.body).toEqual([_toJson(MAYA_ON_MITZI)])
  })

  it('returns 400 VALIDATION_FAILED without a filter, so there is no system-wide list', async () => {
    const res = await request(app).get('/api/reviews')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it.each([
    ['a malformed catId', '?catId=nope', 'catId'],
    ['a 12-character userId', '?userId=twelve%20chars', 'userId'],
    ['a repeated catId', `?catId=${'a'.repeat(24)}&catId=${'b'.repeat(24)}`, 'catId'],
  ])('returns 400 VALIDATION_FAILED for %s, not 500', async (_, query, field) => {
    const res = await request(app).get(`/api/reviews${query}`)

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(res.body.fieldErrors).toHaveProperty(field)
  })

  // Pins the plan: $match + $sort run as one query on the compound index, with no in-memory SORT stage.
  // The spy captures the pipeline the service really sends, then explains that same pipeline
  it.each([
    ['catId', MITZI._id, 'catId_1_createdAt_-1'],
    ['userId', MAYA._id, 'userId_1_createdAt_-1'],
  ])('reads by %s from the compound index, without an in-memory sort', async (key, id, index) => {
    const aggregateSpy = vi.spyOn(Collection.prototype, 'aggregate')
    await request(app).get(`/api/reviews?${key}=${id.toHexString()}`)
    const pipeline = aggregateSpy.mock.lastCall![0] as Document[]
    aggregateSpy.mockRestore()

    const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
    const plan = JSON.stringify(await reviews.aggregate(pipeline).explain('queryPlanner'))

    expect(plan).toContain('"IXSCAN"')
    expect(plan).toContain(`"${index}"`)
    expect(plan).not.toContain('"SORT"')
  })
})

describe('POST /api/reviews', () => {
  const NOW = 50_000
  const INPUT: ReviewInput = { catId: MITZI._id.toHexString(), content: 'Such a sweet cat' }

  beforeEach(async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.insertMany([MAYA, ADMIN])
    const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await cats.insertOne(MITZI)
    // only Date is faked - Supertest and the Mongo driver still need real timers
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function _countReviews() {
    const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
    return reviews.countDocuments()
  }

  it('creates the review, written by the logged-in user, and returns 201 with server-set fields', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', _loginCookie(MAYA))
      .send(INPUT)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      ...INPUT,
      _id: expect.any(String),
      userId: MAYA._id.toHexString(),
      createdAt: NOW,
      updatedAt: NOW,
    })
    const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
    const saved = await reviews.findOne({ _id: new ObjectId(res.body._id as string) })
    expect(saved).toMatchObject({ content: INPUT.content, catId: MITZI._id, userId: MAYA._id })
  })

  it('ignores a client-sent _id, userId, createdAt and updatedAt', async () => {
    const clientId = new ObjectId().toHexString()
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', _loginCookie(MAYA))
      .send({
        ...INPUT,
        _id: clientId,
        userId: ADMIN._id.toHexString(),
        createdAt: 1,
        updatedAt: 1,
      })

    expect(res.status).toBe(201)
    expect(res.body._id).not.toBe(clientId)
    expect(res.body).toMatchObject({
      userId: MAYA._id.toHexString(),
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('stores the content trimmed', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', _loginCookie(MAYA))
      .send({ ...INPUT, content: '  Purrfect  ' })

    expect(res.status).toBe(201)
    expect(res.body.content).toBe('Purrfect')
  })

  it('returns 401 UNAUTHORIZED for a guest and saves nothing', async () => {
    const res = await request(app).post('/api/reviews').send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await _countReviews()).toBe(0)
  })

  it('returns 400 VALIDATION_FAILED with fieldErrors and saves nothing', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', _loginCookie(MAYA))
      .send({ catId: 'nope', content: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(['catId', 'content'])
    expect(await _countReviews()).toBe(0)
  })

  it('returns 404 CAT_NOT_FOUND for a cat that does not exist, and saves nothing', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', _loginCookie(MAYA))
      .send({ ...INPUT, catId: new ObjectId().toHexString() })

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
    expect(await _countReviews()).toBe(0)
  })
})

// PUT and DELETE share the setup: MAYA wrote MAYA_ON_MITZI, NOAM is a user who didn't
async function _insertForEdit() {
  const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  await users.insertMany([MAYA, NOAM, ADMIN])
  const cats = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  await cats.insertOne(MITZI)
  const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  await reviews.insertOne(MAYA_ON_MITZI)
  return reviews
}

// The stored review as the API sends it (not joined): ObjectIds become hex strings
function _toStoredJson(review: ReviewDoc): Review {
  return {
    ...review,
    _id: review._id.toHexString(),
    userId: review.userId.toHexString(),
    catId: review.catId.toHexString(),
  }
}

describe('PUT /api/reviews/:id', () => {
  const NOW = 50_000
  const INPUT: ReviewContentInput = { content: 'Even sweeter on a second visit' }
  const URL = `/api/reviews/${MAYA_ON_MITZI._id.toHexString()}`

  beforeEach(() => {
    // only Date is faked - Supertest and the Mongo driver still need real timers
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    ['the author', MAYA],
    ["an admin, on a review they didn't write", ADMIN],
  ])('lets %s update the content, keeping createdAt and bumping updatedAt', async (_, user) => {
    const reviews = await _insertForEdit()

    const res = await request(app).put(URL).set('Cookie', _loginCookie(user)).send(INPUT)

    const expected = { ...MAYA_ON_MITZI, content: INPUT.content, updatedAt: NOW }
    expect(res.status).toBe(200)
    expect(res.body).toEqual(_toStoredJson(expected))
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(expected)
  })

  // An admin edit must not make the review the admin's: userId stays the author's
  it('ignores a client-sent catId, userId, _id, createdAt and updatedAt', async () => {
    const reviews = await _insertForEdit()

    const res = await request(app)
      .put(URL)
      .set('Cookie', _loginCookie(ADMIN))
      .send({
        ...INPUT,
        _id: new ObjectId().toHexString(),
        catId: TOM._id.toHexString(),
        userId: ADMIN._id.toHexString(),
        createdAt: 1,
        updatedAt: 1,
      })

    expect(res.status).toBe(200)
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual({
      ...MAYA_ON_MITZI,
      content: INPUT.content,
      updatedAt: NOW,
    })
  })

  it('returns 400 VALIDATION_FAILED for empty content and keeps the review', async () => {
    const reviews = await _insertForEdit()

    const res = await request(app)
      .put(URL)
      .set('Cookie', _loginCookie(MAYA))
      .send({ content: '   ' })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(res.body.fieldErrors).toHaveProperty('content')
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(MAYA_ON_MITZI)
  })

  it('returns 401 UNAUTHORIZED for a guest and keeps the review', async () => {
    const reviews = await _insertForEdit()

    const res = await request(app).put(URL).send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(MAYA_ON_MITZI)
  })

  // The ownership check runs before validation, so even a bad body gets 403, not 400
  it("returns 403 FORBIDDEN for a user who didn't write the review, before validating the body", async () => {
    const reviews = await _insertForEdit()

    const res = await request(app)
      .put(URL)
      .set('Cookie', _loginCookie(NOAM))
      .send({ content: '   ' })

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(MAYA_ON_MITZI)
  })

  it.each([
    ['a review that does not exist', new ObjectId().toHexString()],
    ['a malformed id', 'nope'],
  ])('returns 404 REVIEW_NOT_FOUND for %s, not 403 or 500', async (_, id) => {
    await _insertForEdit()

    const res = await request(app)
      .put(`/api/reviews/${id}`)
      .set('Cookie', _loginCookie(NOAM))
      .send(INPUT)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'REVIEW_NOT_FOUND' })
  })
})

describe('DELETE /api/reviews/:id', () => {
  const URL = `/api/reviews/${MAYA_ON_MITZI._id.toHexString()}`

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['the author', MAYA],
    ["an admin, on a review they didn't write", ADMIN],
  ])('lets %s delete the review, with 204', async (_, user) => {
    const reviews = await _insertForEdit()

    const res = await request(app).delete(URL).set('Cookie', _loginCookie(user))

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toBeNull()
  })

  it('returns 401 UNAUTHORIZED for a guest and keeps the review', async () => {
    const reviews = await _insertForEdit()

    const res = await request(app).delete(URL)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(MAYA_ON_MITZI)
  })

  it("returns 403 FORBIDDEN for a user who didn't write the review, and keeps it", async () => {
    const reviews = await _insertForEdit()

    const res = await request(app).delete(URL).set('Cookie', _loginCookie(NOAM))

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
    expect(await reviews.findOne({ _id: MAYA_ON_MITZI._id })).toEqual(MAYA_ON_MITZI)
  })

  it.each([
    ['a review that does not exist', new ObjectId().toHexString()],
    ['a malformed id', 'nope'],
  ])('returns 404 REVIEW_NOT_FOUND for %s, not 403 or 500', async (_, id) => {
    await _insertForEdit()

    const res = await request(app).delete(`/api/reviews/${id}`).set('Cookie', _loginCookie(NOAM))

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'REVIEW_NOT_FOUND' })
  })
})
