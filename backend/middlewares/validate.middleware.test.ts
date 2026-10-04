import express from 'express'
import request from 'supertest'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from './error.middleware.ts'
import { validateBody } from './validate.middleware.ts'

// A throwaway app with a tiny schema - the test is about the middleware, not the cat schema
const _schema = z.object({
  name: z.string().trim().min(2, { error: 'Too short' }),
})

function _createApp() {
  const app = express()
  app.use(express.json())
  app.post('/echo', validateBody(_schema), (req, res) => {
    res.json(req.body)
  })
  app.use(errorHandler)
  return app
}

describe('validateBody', () => {
  const app = _createApp()

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes the parsed body on to the handler', async () => {
    const res = await request(app).post('/echo').send({ name: '  Mitzi  ' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ name: 'Mitzi' })
  })

  it('strips keys the schema does not know', async () => {
    const res = await request(app).post('/echo').send({ name: 'Mitzi', _id: 'abc', createdAt: 1 })

    expect(res.body).toEqual({ name: 'Mitzi' })
  })

  it('returns 400 VALIDATION_FAILED with fieldErrors for an invalid body', async () => {
    const res = await request(app).post('/echo').send({ name: 'M' })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { name: ['Too short'] },
    })
  })
})
