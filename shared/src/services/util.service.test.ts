import { describe, expect, it } from 'vitest'
import { sharedUtilService } from './util.service.ts'

describe('getObjectIdRegex', () => {
  const regex = sharedUtilService.getObjectIdRegex()

  it.each(['652f1c2e9b1e8a3d4c5b6a79', '652F1C2E9B1E8A3D4C5B6A79'])('accepts %s', (id) => {
    expect(regex.test(id)).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['too short', '652f1c2e9b1e8a3d4c5b6a7'],
    ['too long', '652f1c2e9b1e8a3d4c5b6a790'],
    ['not hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['12 characters', 'twelve chars'],
    ['hex inside other text', 'x652f1c2e9b1e8a3d4c5b6a79'],
  ])('rejects %s', (_, id) => {
    expect(regex.test(id)).toBe(false)
  })
})
