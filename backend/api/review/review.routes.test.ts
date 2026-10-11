import { Collection, ObjectId, type Document } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewWithRefs } from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { REVIEW_COLLECTION, type ReviewDoc } from '../../models/review.ts'
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
const ADMIN = _buildUser('admin', true)
const MITZI = _buildCat('Mitzi')
const TOM = _buildCat('Tom')

// Inserted out of order, so a passing test proves the sort
const MAYA_ON_MITZI = _buildReview(MAYA, MITZI, 1_000)
const ADMIN_ON_MITZI = _buildReview(ADMIN, MITZI, 3_000)
const MAYA_ON_TOM = _buildReview(MAYA, TOM, 2_000)

// The review as the API sends it: the exact keys, so a projection bug (an extra field, a leaked
// password / isAdmin, a leftover userId / catId) fails toEqual
function _toJson(review: ReviewDoc): ReviewWithRefs {
  const user = [MAYA, ADMIN].find(({ _id }) => _id.equals(review.userId))!
  const cat = [MITZI, TOM].find(({ _id }) => _id.equals(review.catId))!
  return {
    _id: review._id.toHexString(),
    content: review.content,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: { _id: user._id.toHexString(), fullname: user.fullname },
    cat: { _id: cat._id.toHexString(), name: cat.name, imgUrl: cat.imgUrl },
  }
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
  it('never sends the password or isAdmin of an author', async () => {
    const res = await request(app).get(`/api/reviews?catId=${MITZI._id.toHexString()}`)

    for (const review of res.body as ReviewWithRefs[]) {
      expect(review.user).not.toHaveProperty('password')
      expect(review.user).not.toHaveProperty('isAdmin')
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
