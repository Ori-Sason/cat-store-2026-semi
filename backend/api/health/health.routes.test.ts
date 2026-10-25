import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { app } from '../../app.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'

setupTestDb()

describe('GET /api/health', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 200 ok when Mongo answers the ping', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 503 unavailable when Mongo is unreachable', async () => {
    vi.spyOn(mongoService, 'connect').mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'unavailable' })
    expect(consoleError).toHaveBeenCalled()
  })
})
