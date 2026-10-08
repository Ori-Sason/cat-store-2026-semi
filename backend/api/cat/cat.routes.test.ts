import { ObjectId } from 'mongodb'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAT_LABELS,
  type Cat,
  type CatInput,
  type CatLabel,
  type CatLabelStats,
} from '@cat-store/shared'
import { app } from '../../app.ts'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { authService } from '../auth/auth.service.ts'

setupTestDb()

function _buildUser(username: string, isAdmin: boolean): UserDoc {
  const fullname = `${username} fullname`
  return {
    _id: new ObjectId(),
    username,
    fullname,
    password: 'hash',
    isAdmin,
    createdAt: 1,
    updatedAt: 1,
  }
}

// CAT_OWNER owns every cat _buildCat makes, unless a test says otherwise
const CAT_OWNER = _buildUser('cat_owner', false)
const NON_CAT_OWNER_USER = _buildUser('non_cat_owner', false)
const ADMIN = _buildUser('admin', true)

// setupTestDb empties the DB before each test (registered first, so it runs first)
beforeEach(async () => {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  await collection.insertMany([CAT_OWNER, NON_CAT_OWNER_USER, ADMIN])
})

// A signed loginToken cookie, the same one login sets
function _loginCookie({ _id, username, fullname, isAdmin }: UserDoc): string {
  const loggedInUser = { _id: _id.toHexString(), username, fullname, isAdmin }
  return `loginToken=${authService.createLoginToken(loggedInUser, false)}`
}

// The cat as the API sends it: ObjectIds become hex strings
function _toJson(cat: CatDoc): Cat {
  return { ...cat, _id: cat._id.toHexString(), ownerId: cat.ownerId.toHexString() }
}

async function _insertCat(cat: CatDoc) {
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  await collection.insertOne(cat)
  return collection
}

function _buildCat(overrides: Partial<CatDoc>): CatDoc {
  return {
    _id: new ObjectId(),
    ownerId: CAT_OWNER._id,
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

  it('returns only the first N cats in sort order for limit=N', async () => {
    expect(await _getNames('?limit=2')).toEqual(['Felix', 'garfield'])
    expect(await _getNames('?sortBy=price&sortDir=asc&limit=2')).toEqual(['bella', 'Max'])
  })

  it('returns every cat for a limit above the match count', async () => {
    expect(await _getNames('?isInStock=false&limit=4')).toEqual(['Max'])
  })

  it('ignores invalid params instead of failing', async () => {
    expect(
      await _getNames('?isInStock=maybe&labels=Dog&sortBy=ownerId&sortDir=up&limit=abc'),
    ).toEqual(['Felix', 'garfield', 'Max', 'bella', 'tom'])
  })

  it('reads limit=0 as no limit, not as zero cats', async () => {
    expect(await _getNames('?limit=0')).toHaveLength(CATS.length)
  })
})

describe('GET /api/cats/stats', () => {
  // Calm has an odd-sized group, so its median is unambiguous
  const STATS_CATS: CatDoc[] = [
    _buildCat({ name: 'tom', price: 100, labels: ['Calm', 'Kitten'] }),
    _buildCat({ name: 'Max', price: 300, labels: ['Calm'], isInStock: false }),
    _buildCat({ name: 'garfield', price: 500, labels: ['Calm', 'Senior'] }),
    _buildCat({ name: 'nolabel', price: 50, labels: [] }),
  ]

  function _emptyRow(label: CatLabel): CatLabelStats {
    return { label, count: 0, inStockCount: 0, medianPrice: null, minPrice: null, maxPrice: null }
  }

  it('returns one row per label in CAT_LABELS order: multi-label cats count in each, unlabelled cats in none', async () => {
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.insertMany(STATS_CATS)
    const expectedByLabel: Partial<Record<CatLabel, CatLabelStats>> = {
      Kitten: {
        label: 'Kitten',
        count: 1,
        inStockCount: 1,
        medianPrice: 100,
        minPrice: 100,
        maxPrice: 100,
      },
      Senior: {
        label: 'Senior',
        count: 1,
        inStockCount: 1,
        medianPrice: 500,
        minPrice: 500,
        maxPrice: 500,
      },
      Calm: {
        label: 'Calm',
        count: 3,
        inStockCount: 2,
        medianPrice: 300,
        minPrice: 100,
        maxPrice: 500,
      },
    }

    const res = await request(app).get('/api/cats/stats')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(CAT_LABELS.map((label) => expectedByLabel[label] ?? _emptyRow(label)))
  })

  it('returns a zero row for every label when there are no cats, not 404 or []', async () => {
    const res = await request(app).get('/api/cats/stats')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(CAT_LABELS.map(_emptyRow))
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
    expect(res.body).toEqual(_toJson(cat))
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

  it.each([
    ['the owner', CAT_OWNER],
    ['an admin, on a cat they do not own', ADMIN],
  ])('lets %s delete the cat, with 204', async (_, user) => {
    const cat = _buildCat({ name: 'Mitzi' })
    const collection = await _insertCat(cat)

    const res = await request(app)
      .delete(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(user))

    expect(res.status).toBe(204)
    expect(res.body).toEqual({})
    expect(await collection.findOne({ _id: cat._id })).toBeNull()
  })

  it('returns 401 UNAUTHORIZED for a guest and keeps the cat', async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)

    const res = await request(app).delete(`/api/cats/${cat._id.toHexString()}`)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  it("returns 403 FORBIDDEN for a user who doesn't own the cat, and keeps it", async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)

    const res = await request(app)
      .delete(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(NON_CAT_OWNER_USER))

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  it('returns 404 CAT_NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app)
      .delete(`/api/cats/${new ObjectId().toHexString()}`)
      .set('Cookie', _loginCookie(ADMIN))

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
  })
})

describe('POST /api/cats', () => {
  const NOW = 50_000
  const INPUT: CatInput = {
    name: 'Mitzi',
    price: 120.5,
    labels: ['Kitten', 'Playful'],
    isInStock: true,
    imgUrl: 'https://example.com/mitzi.jpg',
  }

  beforeEach(() => {
    // only Date is faked - Supertest and the Mongo driver still need real timers
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('creates the cat, owned by the logged-in user, and returns 201 with server-set fields', async () => {
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send(INPUT)

    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      ...INPUT,
      _id: expect.any(String),
      ownerId: CAT_OWNER._id.toHexString(),
      createdAt: NOW,
      updatedAt: NOW,
    })
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    const saved = await collection.findOne({ _id: new ObjectId(res.body._id as string) })
    expect(saved).toMatchObject({ ...INPUT, ownerId: CAT_OWNER._id })
  })

  it('ignores a client-sent _id, ownerId, createdAt and updatedAt', async () => {
    const clientId = new ObjectId().toHexString()
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send({
        ...INPUT,
        _id: clientId,
        ownerId: ADMIN._id.toHexString(),
        createdAt: 1,
        updatedAt: 1,
      })

    expect(res.status).toBe(201)
    expect(res.body._id).not.toBe(clientId)
    expect(res.body).toMatchObject({
      ownerId: CAT_OWNER._id.toHexString(),
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('returns 401 UNAUTHORIZED for a guest and saves nothing', async () => {
    const res = await request(app).post('/api/cats').send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    expect(await collection.countDocuments()).toBe(0)
  })

  // requireAuth reads the user from the DB, not just the token
  it('returns 401 UNAUTHORIZED for a valid token of a deleted user', async () => {
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.deleteOne({ _id: CAT_OWNER._id })

    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it("stores an empty imgUrl as ''", async () => {
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send({ ...INPUT, imgUrl: '' })

    expect(res.status).toBe(201)
    expect(res.body.imgUrl).toBe('')
  })

  it('returns 400 VALIDATION_FAILED with fieldErrors and saves nothing', async () => {
    const res = await request(app)
      .post('/api/cats')
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send({ ...INPUT, name: 'M', price: -1 })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_FAILED')
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(['name', 'price'])
    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    expect(await collection.countDocuments()).toBe(0)
  })
})

describe('PUT /api/cats/:id', () => {
  const NOW = 50_000
  const INPUT: CatInput = {
    name: 'Mitzi the Second',
    price: 250,
    labels: ['Senior', 'Calm'],
    isInStock: false,
    imgUrl: '',
  }

  beforeEach(() => {
    // only Date is faked - Supertest and the Mongo driver still need real timers
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    ['the owner', CAT_OWNER],
    ['an admin, on a cat they do not own', ADMIN],
  ])('lets %s update the cat, keeping createdAt and bumping updatedAt', async (_, user) => {
    const cat = _buildCat({ name: 'Mitzi', createdAt: 1_000, updatedAt: 1_000 })
    const collection = await _insertCat(cat)

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(user))
      .send(INPUT)

    expect(res.status).toBe(200)
    const expected = { ...cat, ...INPUT, updatedAt: NOW }
    expect(res.body).toEqual(_toJson(expected))
    expect(await collection.findOne({ _id: cat._id })).toEqual(expected)
  })

  it('ignores a client-sent _id, ownerId, createdAt and updatedAt', async () => {
    const cat = _buildCat({ createdAt: 1_000, updatedAt: 1_000 })
    await _insertCat(cat)

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send({
        ...INPUT,
        _id: new ObjectId().toHexString(),
        ownerId: NON_CAT_OWNER_USER._id.toHexString(),
        createdAt: 1,
        updatedAt: 1,
      })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      _id: cat._id.toHexString(),
      ownerId: CAT_OWNER._id.toHexString(),
      createdAt: 1_000,
      updatedAt: NOW,
    })
  })

  it('returns 401 UNAUTHORIZED for a guest and leaves the cat as it was', async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)

    const res = await request(app).put(`/api/cats/${cat._id.toHexString()}`).send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  // The ownership check runs before validation, so even an invalid body gets the 403
  it("returns 403 FORBIDDEN for a user who doesn't own the cat, before validating the body", async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(NON_CAT_OWNER_USER))
      .send({ ...INPUT, labels: ['Dog'] })

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  it('returns 404 CAT_NOT_FOUND for an id that does not exist', async () => {
    const res = await request(app)
      .put(`/api/cats/${new ObjectId().toHexString()}`)
      .set('Cookie', _loginCookie(ADMIN))
      .send(INPUT)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ code: 'CAT_NOT_FOUND' })
  })

  // requireCatOwner bundles requireAuth, which re-reads the user from the DB
  it('returns 401 UNAUTHORIZED for a valid token of a deleted user', async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)
    const users = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await users.deleteOne({ _id: CAT_OWNER._id })

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send(INPUT)

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  // A token signed while the user was an admin, revoked since. The check must trust the DB's
  // isAdmin (the verified user), not the token's - this fails if it reads the token user
  it('returns 403 FORBIDDEN for a stale admin token of a user who is no longer admin', async () => {
    const cat = _buildCat({})
    const collection = await _insertCat(cat)

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie({ ...NON_CAT_OWNER_USER, isAdmin: true }))
      .send(INPUT)

    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN' })
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })

  it('returns 400 VALIDATION_FAILED with fieldErrors and leaves the cat as it was', async () => {
    const cat = _buildCat({ name: 'Mitzi' })
    const collection = await _insertCat(cat)

    const res = await request(app)
      .put(`/api/cats/${cat._id.toHexString()}`)
      .set('Cookie', _loginCookie(CAT_OWNER))
      .send({ ...INPUT, labels: ['Dog'] })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(res.body.fieldErrors).toHaveProperty('labels')
    expect(await collection.findOne({ _id: cat._id })).toEqual(cat)
  })
})
