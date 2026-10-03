import { describe, expect, it } from 'vitest'
import { catSchema, type CatInput } from './cat.ts'

const validCat: CatInput = {
  name: 'Mitzi',
  price: 120.5,
  labels: ['Kitten', 'Playful'],
  isInStock: true,
  imgUrl: 'https://example.com/mitzi.jpg',
}

const _issuePaths = (input: unknown) => {
  const result = catSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.path.join('.'))
}

describe('catSchema', () => {
  it('accepts a valid cat as is', () => {
    expect(catSchema.parse(validCat)).toEqual(validCat)
  })

  it('strips server-set fields', () => {
    const parsed = catSchema.parse({
      ...validCat,
      _id: 'abc',
      createdAt: 1,
      updatedAt: 2,
      ownerId: 'u1',
    })
    expect(parsed).toEqual(validCat)
  })

  describe('name', () => {
    it('trims whitespace', () => {
      expect(catSchema.parse({ ...validCat, name: '  Mitzi  ' }).name).toBe('Mitzi')
    })

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['only spaces', '   '],
      ['too short', 'M'],
      ['too long', 'M'.repeat(51)],
    ])('rejects a name that is %s', (_, name) => {
      expect(_issuePaths({ ...validCat, name })).toEqual(['name'])
    })
  })

  describe('price', () => {
    it.each([1, 19.9, 19.99, 0.01])('accepts %s', (price) => {
      expect(catSchema.parse({ ...validCat, price }).price).toBe(price)
    })

    it.each([
      ['zero', 0],
      ['negative', -5],
      ['more than 2 decimals', 19.999],
      ['a string', '100'],
      ['NaN', Number.NaN],
    ])('rejects a price that is %s', (_, price) => {
      expect(_issuePaths({ ...validCat, price })).toEqual(['price'])
    })
  })

  describe('labels', () => {
    it('accepts an empty list', () => {
      expect(catSchema.parse({ ...validCat, labels: [] }).labels).toEqual([])
    })

    it('rejects an unknown label', () => {
      expect(_issuePaths({ ...validCat, labels: ['Kitten', 'Grumpy'] })).toEqual(['labels.1'])
    })

    it('rejects duplicate labels', () => {
      expect(_issuePaths({ ...validCat, labels: ['Calm', 'Calm'] })).toEqual(['labels'])
    })
  })

  describe('isInStock', () => {
    it('rejects a non-boolean', () => {
      expect(_issuePaths({ ...validCat, isInStock: 'yes' })).toEqual(['isInStock'])
    })
  })

  describe('imgUrl', () => {
    it('accepts an empty string', () => {
      expect(catSchema.parse({ ...validCat, imgUrl: '' }).imgUrl).toBe('')
    })

    it('accepts an http URL', () => {
      const imgUrl = 'http://example.com/cat.png'
      expect(catSchema.parse({ ...validCat, imgUrl }).imgUrl).toBe(imgUrl)
    })

    it.each([
      ['missing', undefined],
      ['a non-URL', 'not a url'],
      ['a number', 42],
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a data: URL', 'data:image/png;base64,iVBORw0KGgo='],
      ['an ftp: URL', 'ftp://example.com/cat.png'],
    ])('rejects an imgUrl that is %s, with the URL message', (_, imgUrl) => {
      const result = catSchema.safeParse({ ...validCat, imgUrl })
      expect(result.error?.issues).toMatchObject([
        { path: ['imgUrl'], message: 'Image must be a valid URL' },
      ])
    })
  })
})
