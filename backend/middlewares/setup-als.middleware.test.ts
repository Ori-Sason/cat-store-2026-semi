import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { alsService } from '../services/als.service.ts'
import { setupAsyncLocalStorage } from './setup-als.middleware.ts'

// A throwaway app whose route echoes the ALS store back - the test is about the middleware,
// so the route only exposes what a downstream service would see.
// ALS isolation itself (across awaits, between concurrent requests) is Node's job, not tested here
function _createApp() {
  const app = express()
  app.use(setupAsyncLocalStorage)
  app.get('/store', (req, res) => {
    res.json(alsService.getStore())
  })
  return app
}

describe('setupAsyncLocalStorage', () => {
  const app = _createApp()

  // the error handler logs the store's ID and the FE shows the header's - they must match
  it('sends the store request ID in the X-Request-Id header', async () => {
    const res = await request(app).get('/store')

    expect(res.headers['x-request-id']).toBeTypeOf('string')
    expect(res.body).toEqual({ requestId: res.headers['x-request-id'], loggedInUser: null })
  })

  it('ignores a client-sent X-Request-Id', async () => {
    const res = await request(app).get('/store').set('X-Request-Id', 'client-chosen-id')

    expect(res.headers['x-request-id']).not.toBe('client-chosen-id')
    expect(res.body.requestId).not.toBe('client-chosen-id')
  })

  it('gives every request a new ID', async () => {
    const first = await request(app).get('/store')
    const second = await request(app).get('/store')

    expect(first.body.requestId).not.toBe(second.body.requestId)
  })
})
