import { ObjectId } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cat } from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'

setupTestDb()

function _buildCat(overrides: Partial<CatDoc>): CatDoc {
  return {
    _id: new ObjectId(),
    name: 'Mitzi',
    price: 100,
    labels: [],
    isInStock: true,
    imgUrl: 'https://example.com/cat.jpg',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  }
}

// createdAt order: tom → bella → Max → garfield → Felix (newest)
const CATS: CatDoc[] = [
  _buildCat({ name: 'tom', price: 300, labels: ['Kitten', 'Calm'], createdAt: 1_000 }),
  _buildCat({ name: 'bella', price: 100, labels: ['Kitten'], createdAt: 2_000 }),
  _buildCat({ name: 'Max', price: 200, labels: ['Calm'], isInStock: false, createdAt: 3_000 }),
  _buildCat({ name: 'garfield', price: 500, labels: ['Senior', 'Calm'], createdAt: 4_000 }),
  _buildCat({ name: 'Felix', price: 400, labels: ['Kitten', 'Calm', 'Indoor'], createdAt: 5_000 }),
]

async function _getNames(query: string): Promise<string[]> {
  const res = await request(app).get(`/api/cats${query}`)
  expect(res.status).toBe(200)
  return res.body.map((cat: Cat) => cat.name)
}

describe('GET /api/cats', () => {
  beforeEach(async () => {
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.insertMany(CATS)
  })

  it('returns every cat, newest first, with a string _id', async () => {
    const res = await request(app).get('/api/cats')

    expect(res.status).toBe(200)
    expect(res.body.map((cat: Cat) => cat.name)).toEqual([
      'Felix',
      'garfield',
      'Max',
      'bella',
      'tom',
    ])
    expect(res.body[0]._id).toBe(CATS[4]!._id.toHexString())
  })

  it('filters by txt, case-insensitive', async () => {
    expect(await _getNames('?txt=MA')).toEqual(['Max'])
  })

  it('treats regex characters in txt literally', async () => {
    expect(await _getNames('?txt=.*')).toEqual([])
  })

  it('filters by isInStock=false', async () => {
    expect(await _getNames('?isInStock=false')).toEqual(['Max'])
  })

  it('returns only cats that have every selected label', async () => {
    expect(await _getNames('?labels=Kitten&labels=Calm')).toEqual(['Felix', 'tom'])
  })

  it('sorts by name, case-insensitive', async () => {
    expect(await _getNames('?sortBy=name&sortDir=asc')).toEqual([
      'bella',
      'Felix',
      'garfield',
      'Max',
      'tom',
    ])
  })

  it('sorts by price ascending', async () => {
    expect(await _getNames('?sortBy=price&sortDir=asc')).toEqual([
      'bella',
      'Max',
      'tom',
      'Felix',
      'garfield',
    ])
  })

  it('ignores invalid params instead of failing', async () => {
    expect(await _getNames('?isInStock=maybe&labels=Dog&sortBy=ownerId&sortDir=up')).toEqual([
      'Felix',
      'garfield',
      'Max',
      'bella',
      'tom',
    ])
  })
})

describe('GET /api/cats/:id', () => {
  beforeEach(() => {
    // 404s are logged as warnings by the error handler - keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the cat', async () => {
    const cat = _buildCat({ name: 'Mitzi' })
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.insertOne(cat)

    const res = await request(app).get(`/api/cats/${cat._id.toHexString()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ...cat, _id: cat._id.toHexString() })
  })

  it('returns 404 CAT_NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app).get(`/api/cats/${new ObjectId().toHexString()}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
    expect(res.body.requestId).toEqual(expect.any(String))
  })

  it('returns 404 CAT_NOT_FOUND for a malformed id, not 500', async () => {
    const res = await request(app).get('/api/cats/twelve chars')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
  })
})

describe('DELETE /api/cats/:id', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes the cat and returns 204', async () => {
    const cat = _buildCat({ name: 'Mitzi' })
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.insertOne(cat)

    const res = await request(app).delete(`/api/cats/${cat._id.toHexString()}`)

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(await collection.findOne({ _id: cat._id })).toBeNull()
  })

  it('returns 404 CAT_NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app).delete(`/api/cats/${new ObjectId().toHexString()}`)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
  })
})
