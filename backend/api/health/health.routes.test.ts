import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorBody } from '@cat-store/shared'
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

  it('returns 503 SERVICE_UNAVAILABLE and logs the cause when Mongo is unreachable', async () => {
    const cause = new Error('connect ECONNREFUSED')
    vi.spyOn(mongoService, 'ping').mockRejectedValueOnce(cause)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' } satisfies Partial<ApiErrorBody>)
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ cause }))
  })
})
