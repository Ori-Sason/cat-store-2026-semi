import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoggedInUser, SignupInput } from '@cat-store/shared'
import { app } from '../../app.ts'
import { config } from '../../config/index.ts'
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
const ONE_DAY_S = 24 * 60 * 60

const TOKEN_USER: LoggedInUser = {
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  username: 'admin',
  fullname: 'Admin User',
  isAdmin: true,
}

// The last one wins in the browser, so a clear followed by a set means "logged in"
function _getLoginTokenCookie(res: request.Response): string | undefined {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
  return setCookie?.findLast((cookie) => cookie.startsWith('loginToken='))
}

// exp - iat, the lifetime the token was signed with
function _getTokenTtlS(res: request.Response): number {
  const token = _getLoginTokenCookie(res)!.split(';')[0]!.split('=')[1]!
  const { iat, exp } = jwt.decode(token) as jwt.JwtPayload
  return exp! - iat!
}

// jsonwebtoken refuses to sign with "none", so build one by hand
function _unsignedToken(payload: object): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`
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
    expect(cookie).toMatch(/Path=\//)
    expect(_getTokenTtlS(res)).toBe(ONE_DAY_S)
  })

  it('sets a 7-day cookie when isRemembered is true', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...SIGNUP, isRemembered: true })

    expect(res.status).toBe(201)
    expect(_getLoginTokenCookie(res)).toMatch(new RegExp(`Max-Age=${SEVEN_DAYS_S}`))
    expect(_getTokenTtlS(res)).toBe(SEVEN_DAYS_S)
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
    expect(_getTokenTtlS(res)).toBe(SEVEN_DAYS_S)
  })

  it('replaces an expired cookie with a fresh one', async () => {
    const expired = jwt.sign({ ...TOKEN_USER, exp: 1 }, config.jwtSecret)

    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', `loginToken=${expired}`)
      .send({ username: 'user', password: SIGNUP.password })

    expect(res.status).toBe(200)
    expect(_getLoginTokenCookie(res)).not.toMatch(/^loginToken=;/)
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

  it('returns 413 PAYLOAD_TOO_LARGE for an oversized body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'a'.repeat(200 * 1024) })

    expect(res.status).toBe(413)
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE')
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
    expect(_getLoginTokenCookie(res)).toBeUndefined() // a valid cookie is left alone
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

  it.each([
    ['signed with another secret', () => jwt.sign(TOKEN_USER, 'not-the-secret')],
    ['expired', () => jwt.sign({ ...TOKEN_USER, exp: 1 }, config.jwtSecret)],
    ['unsigned (alg: none)', () => _unsignedToken(TOKEN_USER)],
    ['not a JWT at all', () => 'garbage'],
  ])('returns null and clears the cookie for a token that is %s', async (_, makeToken) => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `loginToken=${makeToken()}`)

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
    expect(_getLoginTokenCookie(res)).toMatch(/^loginToken=;/)
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

  it('returns 204 for a guest too', async () => {
    const res = await request(app).post('/api/auth/logout')

    expect(res.status).toBe(204)
  })
})
