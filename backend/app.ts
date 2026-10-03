import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'

import { setupAsyncLocalStorage } from './middlewares/setup-als.middleware.ts'

import { HttpError } from './models/http-error.ts'
import { errorHandler } from './middlewares/error.middleware.ts'

import { catRoutes } from './api/cat/cat.routes.ts'

// The Express app alone - no DB connect, no listen. server.ts boots it,
// and tests hand it to Supertest directly
export const app = express()

app.use(setupAsyncLocalStorage) // first - creates the per-request store

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(import.meta.dirname, 'public')))
} else {
  // No need to use cors anymore because of Vite proxy (see note in learning-notes/backend.md)
}

app.use(express.json())
app.use(cookieParser())

/* ROUTES */
app.use('/api/cats', catRoutes)

app.use('/api', (req) => {
  throw new HttpError(
    404,
    'ROUTE_NOT_FOUND',
    `${req.method} /api${req.path} is not supported in this API`,
  )
})
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, 'public', 'index.html'))
})
app.use(errorHandler)
