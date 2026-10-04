import { describe, expect, it } from 'vitest'
import { utilService } from './util.service'

describe('utilService.formatPrice', () => {
  it('drops the cents for a whole price', () => {
    expect(utilService.formatPrice(120)).toBe('$120')
  })

  it('shows two decimals otherwise', () => {
    expect(utilService.formatPrice(95.5)).toBe('$95.50')
  })

  it('groups thousands', () => {
    expect(utilService.formatPrice(1250)).toBe('$1,250')
  })
})
