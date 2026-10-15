import express from 'express'
import request from 'supertest'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from './error.middleware.ts'
import { validateBody, validateQuery } from './validate.middleware.ts'

// A throwaway app with a tiny schema - the test is about the middleware, not the cat schema
const _schema = z.object({
  name: z.string().trim().min(2, { error: 'Too short' }),
})

// An object-level rule, like reviewFilterSchema's "at least one filter"
const _querySchema = z
  .object({ a: z.string().optional(), b: z.string().optional() })
  .refine(({ a, b }) => a !== undefined || b !== undefined, { error: 'Need a or b' })

function _createApp() {
  const app = express()
  app.use(express.json())
  app.post('/echo', validateBody(_schema), (req, res) => {
    res.json(req.body)
  })
  app.get('/echo', validateQuery(_querySchema), (req, res) => {
    res.json(req.query)
  })
  // Two query validators in a row: the second must be able to replace the first one's value
  app.get(
    '/echo-twice',
    validateQuery(_querySchema),
    validateQuery(z.object({ a: z.string().transform(Number) })),
    (req, res) => {
      res.json(req.query)
    },
  )
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

describe('validateQuery', () => {
  const app = _createApp()

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Express 5's req.query is a getter - this fails if the parsed value doesn't replace it
  it('passes the parsed query on to the handler, without unknown keys', async () => {
    const res = await request(app).get('/echo?a=1&extra=2')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ a: '1' })
  })

  it('returns 400 VALIDATION_FAILED with an object-level error in the message', async () => {
    const res = await request(app).get('/echo')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Invalid request query: Need a or b',
    })
  })

  it('returns fieldErrors for an invalid param', async () => {
    const res = await request(app).get('/echo?a=1&a=2')

    expect(res.status).toBe(400)
    expect(res.body.fieldErrors).toHaveProperty('a')
  })

  it('lets a second validateQuery replace the parsed query', async () => {
    const res = await request(app).get('/echo-twice?a=1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ a: 1 })
  })
})
