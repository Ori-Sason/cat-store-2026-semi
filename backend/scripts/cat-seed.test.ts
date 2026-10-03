import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAT_LABELS, catSchema } from '@cat-store/shared'
import { buildSeedCat, getRandomLabels, type RawCat } from './cat-seed.ts'

const AGE_LABELS = ['Kitten', 'Adult', 'Senior']
const HAIR_LABELS = ['Long-hair', 'Short-hair']

const rawCat: RawCat = {
  name: 'Destiny Wade',
  price: 2067,
  createdAt: 1587412322759,
  isInStock: false,
}

describe('getRandomLabels', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns no labels when every roll is low', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(getRandomLabels()).toEqual([])
  })

  it('returns one age, one hair and every other label when every roll is high', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(getRandomLabels()).toEqual([
      'Senior',
      'Playful',
      'Calm',
      'Affectionate',
      'Short-hair',
      'Indoor',
      'Good with kids',
    ])
  })

  it('never mixes ages or hair types, and keeps CAT_LABELS order', () => {
    for (let i = 0; i < 200; i++) {
      const labels = getRandomLabels()
      expect(labels.filter((label) => AGE_LABELS.includes(label)).length).toBeLessThanOrEqual(1)
      expect(labels.filter((label) => HAIR_LABELS.includes(label)).length).toBeLessThanOrEqual(1)
      expect(labels).toEqual(CAT_LABELS.filter((label) => labels.includes(label)))
    }
  })
})

describe('buildSeedCat', () => {
  it('keeps the JSON fields and fills in the missing ones', () => {
    const cat = buildSeedCat(rawCat)
    expect(cat).toMatchObject(rawCat)
    expect(cat.updatedAt).toBe(rawCat.createdAt)
    expect(cat.imgUrl).toBe(`https://robohash.org/${cat._id.toHexString()}?set=set4`)
    expect(catSchema.safeParse(cat).success).toBe(true)
  })

  it('throws on a row the schema rejects', () => {
    expect(() => buildSeedCat({ ...rawCat, price: 0 })).toThrow()
  })

  it('builds every cat in cats.json', () => {
    const rawCats: RawCat[] = JSON.parse(
      readFileSync(join(import.meta.dirname, 'data', 'cats.json'), 'utf8'),
    )
    expect(() => rawCats.map((raw) => buildSeedCat(raw))).not.toThrow()
  })
})
