import { ObjectId } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicUser } from '@cat-store/shared'
import { app } from '../../app.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'

setupTestDb()

const USER: UserDoc = {
  _id: new ObjectId(),
  username: 'muki',
  fullname: 'Muki Ben-David',
  password: 'hash',
  isAdmin: true,
  createdAt: 1_000,
  updatedAt: 2_000,
}

describe('GET /api/users/:id', () => {
  beforeEach(async () => {
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.insertOne(USER)
    // 404s are logged as warnings by the error handler - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the public user to a guest: no username, password or updatedAt', async () => {
    const res = await request(app).get(`/api/users/${USER._id.toHexString()}`)

    expect(res.status).toBe(200)
    // toEqual, not toMatchObject: any extra key fails the test
    expect(res.body).toEqual({
      _id: USER._id.toHexString(),
      fullname: USER.fullname,
      isAdmin: true,
      createdAt: USER.createdAt,
    } satisfies PublicUser)
  })

  it('returns 404 USER_NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app).get(`/api/users/${new ObjectId().toHexString()}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('returns 404 USER_NOT_FOUND for a malformed id, not 500', async () => {
    const res = await request(app).get('/api/users/not-an-id')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})
