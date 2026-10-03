import { ObjectId } from 'mongodb'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
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
