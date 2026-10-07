import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoggedInUser, SignupInput } from '@cat-store/shared'
import { app } from '../../app.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'

setupTestDb()

const SIGNUP: SignupInput = {
  fullname: 'Regular User',
  username: 'user',
  password: 'Secret-pass1',
  isRemembered: false,
}

const SEVEN_DAYS_S = 7 * 24 * 60 * 60

function _getLoginTokenCookie(res: request.Response): string | undefined {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
  return setCookie?.find((cookie) => cookie.startsWith('loginToken='))
}

async function _getUserDoc(username: string) {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.findOne({ username })
}

beforeEach(() => {
  // 4xx are logged as warnings by the error handler - keep test output clean
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/auth/signup', () => {
  it('creates the user, returns 201 with the logged-in user and sets a session cookie', async () => {
    const res = await request(app).post('/api/auth/signup').send(SIGNUP)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      _id: expect.stringMatching(/^[a-f0-9]{24}$/),
      fullname: 'Regular User',
      username: 'user',
      isAdmin: false,
    })
    const cookie = _getLoginTokenCookie(res)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).not.toMatch(/Max-Age|Expires/)
  })

  it('sets a 7-day cookie when isRemembered is true', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...SIGNUP, isRemembered: true })

    expect(res.status).toBe(201)
    expect(_getLoginTokenCookie(res)).toMatch(new RegExp(`Max-Age=${SEVEN_DAYS_S}`))
  })

  it('stores a bcrypt hash, ignores a client-sent isAdmin and does not store isRemembered', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...SIGNUP, isAdmin: true, isRemembered: true })

    expect(res.status).toBe(201)
    expect(res.body.isAdmin).toBe(false)
    const doc = await _getUserDoc('user')
    expect(doc).not.toHaveProperty('isRemembered')
    expect(doc?.isAdmin).toBe(false)
    expect(doc?.password).not.toBe(SIGNUP.password)
    expect(await bcrypt.compare(SIGNUP.password, doc!.password)).toBe(true)
  })

  it('returns 400 VALIDATION_FAILED for a weak password and saves nothing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...SIGNUP, password: 'weak' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
    expect(res.body.fieldErrors).toHaveProperty('password')
    expect(_getLoginTokenCookie(res)).toBeUndefined()
    expect(await _getUserDoc('user')).toBeNull()
  })

  it('returns 409 USERNAME_TAKEN for a username that exists in another case', async () => {
    await request(app).post('/api/auth/signup').send(SIGNUP)

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...SIGNUP, username: 'USER' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('USERNAME_TAKEN')
    expect(_getLoginTokenCookie(res)).toBeUndefined()
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(SIGNUP)
  })

  it('returns the logged-in user and sets a session cookie, with a case-insensitive username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'User', password: SIGNUP.password })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ username: 'user', fullname: 'Regular User', isAdmin: false })
    expect(res.body).not.toHaveProperty('password')
    expect(_getLoginTokenCookie(res)).not.toMatch(/Max-Age|Expires/)
  })

  it('sets a 7-day cookie when isRemembered is true', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: SIGNUP.password, isRemembered: true })

    expect(res.status).toBe(200)
    expect(_getLoginTokenCookie(res)).toMatch(new RegExp(`Max-Age=${SEVEN_DAYS_S}`))
  })

  it('returns the same 401 INVALID_CREDENTIALS for a wrong password and an unknown user', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'Wrong-pass1' })
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: SIGNUP.password })

    for (const res of [wrongPassword, unknownUser]) {
      expect(res.status).toBe(401)
      expect(res.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong username or password',
      })
      expect(_getLoginTokenCookie(res)).toBeUndefined()
    }
  })

  it('returns 400 VALIDATION_FAILED for a missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'user' })

    expect(res.status).toBe(400)
    expect(res.body.fieldErrors).toHaveProperty('password')
  })
})

describe('GET /api/auth/me', () => {
  it('returns null for a guest', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('returns the logged-in user after signup', async () => {
    const agent = request.agent(app)
    const signupRes = await agent.post('/api/auth/signup').send(SIGNUP)

    const res = await agent.get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(signupRes.body)
  })

  it('returns the fresh isAdmin from the DB, not the one in the token', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(SIGNUP)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.updateOne({ username: 'user' }, { $set: { isAdmin: true } })

    const res = await agent.get('/api/auth/me')

    expect(res.body.isAdmin).toBe(true)
  })

  it('returns null and clears the cookie when the user no longer exists', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(SIGNUP)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    const res = await agent.get('/api/auth/me')

    expect(res.body).toBeNull()
    expect(_getLoginTokenCookie(res)).toMatch(/^loginToken=;/)
  })

  it('returns null for a token signed with another secret', async () => {
    const forgedUser: LoggedInUser = {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      username: 'admin',
      fullname: 'Admin User',
      isAdmin: true,
    }
    const forged = jwt.sign(forgedUser, 'not-the-secret')

    const res = await request(app).get('/api/auth/me').set('Cookie', `loginToken=${forged}`)

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie, so /me returns null', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(SIGNUP)

    const res = await agent.post('/api/auth/logout')

    expect(res.status).toBe(204)
    expect(_getLoginTokenCookie(res)).toMatch(/^loginToken=;/)
    expect((await agent.get('/api/auth/me')).body).toBeNull()
  })
})
