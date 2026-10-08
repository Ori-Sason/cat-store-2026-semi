import cookieParser from 'cookie-parser'
import express from 'express'
import { ObjectId } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '../api/auth/auth.service.ts'
import { USER_COLLECTION, type UserDoc } from '../models/user.ts'
import { alsService } from '../services/als.service.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { setupTestDb } from '../test/test-db.helper.ts'
import { attachTokenUser } from './attach-token-user.middleware.ts'
import { errorHandler } from './error.middleware.ts'
import { requireAuth } from './require-auth.middleware.ts'
import { setupAsyncLocalStorage } from './setup-als.middleware.ts'

setupTestDb()

const USER: UserDoc = {
  _id: new ObjectId(),
  username: 'mitzi',
  fullname: 'Mitzi',
  password: 'hash',
  isAdmin: false,
  createdAt: 1,
  updatedAt: 1,
}

// A signed loginToken cookie, the same one login sets
function _loginCookie({ _id, username, fullname, isAdmin }: UserDoc): string {
  const loggedInUser = { _id: _id.toHexString(), username, fullname, isAdmin }
  return `loginToken=${authService.createLoginToken(loggedInUser, false)}`
}

// A throwaway app with the real request-context chain. The routes stand in for permission
// checks: they echo the verified user, the way _checkCatOwner reads it
function _createApp() {
  const app = express()
  app.use(setupAsyncLocalStorage)
  app.use(cookieParser())
  app.use(attachTokenUser)

  const echoVerifiedUser: express.RequestHandler = (_req, res) => {
    res.json(alsService.getVerifiedUser())
  }
  // What a bundled require* mounted after requireAuth produces
  app.get('/twice', requireAuth, requireAuth, echoVerifiedUser)
  // A check written without requireAuth in front
  app.get('/no-auth', echoVerifiedUser)

  app.use(errorHandler)
  return app
}

describe('requireAuth', () => {
  const app = _createApp()

  beforeEach(async () => {
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.insertOne(USER)
    // the error handler logs every error - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the DB once when it runs twice in one request', async () => {
    // spy without a mock implementation - the real DB read still runs
    const getByIdSpy = vi.spyOn(authService, 'getLoggedInUserById')

    const res = await request(app).get('/twice').set('Cookie', _loginCookie(USER))

    expect(res.status).toBe(200)
    expect(res.body._id).toBe(USER._id.toHexString())
    expect(getByIdSpy).toHaveBeenCalledTimes(1)
  })

  it('returns 401 UNAUTHORIZED for a guest', async () => {
    const res = await request(app).get('/twice')

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
  })

  // Same as /api/auth/me: a dead token is dropped, so the browser stops sending it
  it('returns 401 and clears the cookie for a valid token of a deleted user', async () => {
    const deletedUser = { ...USER, _id: new ObjectId() }

    const res = await request(app).get('/twice').set('Cookie', _loginCookie(deletedUser))

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNAUTHORIZED')
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(setCookie?.find((cookie) => cookie.startsWith('loginToken='))).toMatch(/^loginToken=;/)
  })

  // Both layers together: a check mounted without requireAuth fails loudly, even with a valid
  // token. The message pins it to getVerifiedUser, so any other 500 doesn't pass this test
  it('two layers: fails with 500, not 200, when a route reads the verified user without requireAuth', async () => {
    const res = await request(app).get('/no-auth').set('Cookie', _loginCookie(USER))

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ code: 'INTERNAL' })
    expect(res.body.message).toContain('missing requireAuth')
  })
})
