import { describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { utilService } from './util.service.ts'

describe('utilService.toObjectId', () => {
  it('returns an ObjectId for a 24-char hex string', () => {
    const hex = '65a1b2c3d4e5f60718293a4b'
    expect(utilService.toObjectId(hex)).toEqual(new ObjectId(hex))
  })

  it('returns null for a malformed id, including a 12-char string', () => {
    expect(utilService.toObjectId('nope')).toBeNull()
    expect(utilService.toObjectId('twelve chars')).toBeNull()
  })
})

describe('utilService.escapeRegex', () => {
  it('escapes regex special characters so they match literally', () => {
    const escaped = utilService.escapeRegex('a.b*c')
    expect(escaped).toBe('a\\.b\\*c')
    expect(new RegExp(escaped).test('a.b*c')).toBe(true)
    expect(new RegExp(escaped).test('axbbc')).toBe(false)
  })

  it('leaves plain text untouched', () => {
    expect(utilService.escapeRegex('tom cat')).toBe('tom cat')
  })
})

describe('utilService.buildSort', () => {
  interface Doc {
    name: string
    price: number
  }

  it('maps the direction to 1 / -1 with an _id tiebreak', () => {
    expect(utilService.buildSort<Doc>({ sortBy: 'price', sortDir: 'asc' })).toEqual({
      price: 1,
      _id: 1,
    })
    expect(utilService.buildSort<Doc>({ sortBy: 'name', sortDir: 'desc' })).toEqual({
      name: -1,
      _id: 1,
    })
  })
})
