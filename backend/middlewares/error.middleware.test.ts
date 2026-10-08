import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'
import { errorHandler } from './error.middleware.ts'

const REQUEST_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// A throwaway app with routes that fail on purpose - no real routes exist.
// This keeps the test about the handler, not about a feature
function _createApp() {
  const app = express()
  app.use(express.json())

  app.get('/not-found', () => {
    throw new HttpError(404, 'CAT_NOT_FOUND', 'Cat not found')
  })
  app.post('/invalid', () => {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid cat', { name: ['Required'] })
  })
  app.post('/echo', (req, res) => {
    res.json(req.body)
  })
  app.get('/crash', () => {
    throw new Error('Mongo exploded')
  })
  app.get(
    '/with-request-id',
    (req, res, next) => alsService.run({ requestId: REQUEST_ID, loggedInUser: null }, next),
    () => {
      throw new HttpError(404, 'CAT_NOT_FOUND', 'Cat not found')
    },
  )

  app.use(errorHandler)
  return app
}

describe('errorHandler', () => {
  const app = _createApp()

  beforeEach(() => {
    // the handler logs every error - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('turns an HttpError into its status and ApiErrorBody', async () => {
    const res = await request(app).get('/not-found')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ code: 'CAT_NOT_FOUND', message: 'Cat not found' })
  })

  it('includes fieldErrors when the HttpError has them', async () => {
    const res = await request(app).post('/invalid')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Invalid cat',
      fieldErrors: { name: ['Required'] },
    })
  })

  it('returns 400 VALIDATION_FAILED for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{ "name": ')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ code: 'VALIDATION_FAILED', message: 'Malformed JSON body' })
  })

  it('returns 413 PAYLOAD_TOO_LARGE for a body over the express.json() limit', async () => {
    const res = await request(app)
      .post('/echo')
      .send({ name: 'a'.repeat(200 * 1024) })

    expect(res.status).toBe(413)
    expect(res.body).toEqual({ code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' })
  })

  it('returns 500 INTERNAL with the error message outside production', async () => {
    const res = await request(app).get('/crash')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ code: 'INTERNAL', message: 'Mongo exploded' })
  })

  it('hides the error message in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const res = await request(app).get('/crash')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ code: 'INTERNAL', message: 'Internal server error' })
  })

  it('adds the requestId from the request context', async () => {
    const res = await request(app).get('/with-request-id')

    expect(res.body.requestId).toBe(REQUEST_ID)
  })

  describe('console logs', () => {
    it('logs an unexpected error with its stack', async () => {
      await request(app).get('/crash')

      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Mongo exploded' }),
      )
    })

    it('logs an expected client error as a single warning', async () => {
      await request(app).get('/not-found')

      expect(console.warn).toHaveBeenCalledOnce()
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})
