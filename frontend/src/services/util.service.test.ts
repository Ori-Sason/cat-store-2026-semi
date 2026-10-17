import type { Location, ShouldRevalidateFunctionArgs } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { ApiError } from '../models/api-error'
import { useUserMsgStore } from '../store/user-msg.store'
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

describe('utilService.getFitCount', () => {
  const { getFitCount } = utilService
  const GAP = 4
  const MORE_WIDTH = 30

  it('fits every item when there is room', () => {
    expect(getFitCount([50, 50, 50], 200, GAP, MORE_WIDTH)).toBe(3)
  })

  it('fits the last item without reserving room for "+N"', () => {
    // 50 + 4 + 50 + 4 + 50 = 158, exactly the row
    expect(getFitCount([50, 50, 50], 158, GAP, MORE_WIDTH)).toBe(3)
  })

  it('stops early so "+N" still fits after the shown items', () => {
    // 2 items + "+N" = 50 + 4 + 50 + 4 + 30 = 138; a 3rd item would need 54 more
    expect(getFitCount([50, 50, 50, 50], 150, GAP, MORE_WIDTH)).toBe(2)
  })

  it('drops an item that fits on its own but not next to "+N"', () => {
    // item 2 ends at 104, but 104 + 4 + 30 > 120
    expect(getFitCount([50, 50, 50], 120, GAP, MORE_WIDTH)).toBe(1)
  })

  it('returns 0 when not even one item fits next to "+N"', () => {
    expect(getFitCount([80, 50], 100, GAP, MORE_WIDTH)).toBe(0)
  })

  it('returns 0 for no items', () => {
    expect(getFitCount([], 100, GAP, MORE_WIDTH)).toBe(0)
  })
})

describe('utilService.formatDate', () => {
  it('shows a short month, the day and the year', () => {
    // midday UTC, so any test machine's timezone lands on the same date
    expect(utilService.formatDate(Date.UTC(2026, 9, 4, 12))).toBe('Oct 4, 2026')
  })
})

describe('utilService.formatTime', () => {
  // Local time on purpose: the time shows in the viewer's timezone
  it('shows 24-hour hours and minutes', () => {
    expect(utilService.formatTime(new Date(2026, 9, 4, 14, 32).getTime())).toBe('14:32')
  })

  it('pads a single-digit hour and keeps midnight as 00', () => {
    expect(utilService.formatTime(new Date(2026, 9, 4, 9, 5).getTime())).toBe('09:05')
    expect(utilService.formatTime(new Date(2026, 9, 4, 0, 7).getTime())).toBe('00:07')
  })
})

describe('utilService.toActionError', () => {
  beforeEach(() => {
    useUserMsgStore.setState({ msg: null })
  })

  it('shows the error and passes an API error status through', () => {
    const result = utilService.toActionError(new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found'))

    expect(result).toMatchObject({ data: null, init: { status: 404 } })
    expect(useUserMsgStore.getState().msg).toMatchObject({
      txt: "Cat doesn't exist (anymore).",
      type: 'error',
    })
  })

  it('returns a 500 when there is no response status', () => {
    const result = utilService.toActionError(new ApiError(0, 'NETWORK_ERROR', 'Network Error'))

    expect(result).toMatchObject({ data: null, init: { status: 500 } })
  })
})

describe('utilService.withSilentReject', () => {
  it('returns the same promise, still rejecting for <Await>', async () => {
    const promise = Promise.reject(new Error('down'))

    const result = utilService.withSilentReject(promise)

    expect(result).toBe(promise)
    await expect(result).rejects.toThrow('down')
  })
})

describe('utilService.skipReloadOnActionAt', () => {
  const shouldRevalidate = utilService.skipReloadOnActionAt('/review')

  // Only the fields it reads: the rest of the args don't change the answer
  function _argsFor(formAction: string | undefined, defaultShouldRevalidate = true) {
    return { formAction, defaultShouldRevalidate } as ShouldRevalidateFunctionArgs
  }

  it.each(['/review', '/review/review-1'])('skips the reload after an action on %s', (path) => {
    expect(shouldRevalidate(_argsFor(path))).toBe(false)
  })

  it.each([
    ['another action', '/cat/cat-1'],
    ['a look-alike path', '/reviews-export'],
    ['a navigation (no action)', undefined],
  ])('keeps the default after %s', (_, formAction) => {
    expect(shouldRevalidate(_argsFor(formAction, true))).toBe(true)
    expect(shouldRevalidate(_argsFor(formAction, false))).toBe(false)
  })
})

describe('utilService.getFirstName', () => {
  it('returns the first word', () => {
    expect(utilService.getFirstName('Ori Sason')).toBe('Ori')
  })

  it('returns a one-word name as is', () => {
    expect(utilService.getFirstName('Ori')).toBe('Ori')
  })

  it('skips leading spaces and splits on any whitespace', () => {
    expect(utilService.getFirstName('  Ori\tSason')).toBe('Ori')
  })
})

describe('utilService.getFirstLetter', () => {
  it('returns the first letter, uppercased', () => {
    expect(utilService.getFirstLetter('ori sason')).toBe('O')
  })

  it('skips leading spaces', () => {
    expect(utilService.getFirstLetter('  ori')).toBe('O')
  })
})

describe('utilService.getSafeRedirectTo', () => {
  const { getSafeRedirectTo } = utilService

  it('returns a same-site path with its search', () => {
    expect(getSafeRedirectTo('/cat/1?txt=Mitzi')).toBe('/cat/1?txt=Mitzi')
  })

  it('defaults to /cat without a redirectTo', () => {
    expect(getSafeRedirectTo(null)).toBe('/cat')
  })

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'cat', ''])(
    'ignores %j, which is not a same-site path',
    (redirectTo) => {
      expect(getSafeRedirectTo(redirectTo)).toBe('/cat')
    },
  )
})

// Only the fields the functions read: a real Location also has hash and key
function _location(pathname: string, search: string, state: unknown): Location {
  return { pathname, search, state, hash: '', key: 'default' }
}

describe('utilService.buildBackToState', () => {
  it('points back at the current page with its search', () => {
    expect(utilService.buildBackToState(_location('/cat', '?labels=Calm', null))).toEqual({
      backTo: '/cat?labels=Calm',
    })
  })
})

describe('utilService.getBackTo', () => {
  it('reads backTo from the location state', () => {
    expect(utilService.getBackTo(_location('/cat/1', '', { backTo: '/user/u1' }))).toBe('/user/u1')
  })

  it('falls back to the plain list with no state', () => {
    expect(utilService.getBackTo(_location('/cat/1', '', null))).toBe('/cat')
  })
})

describe('utilService.getRandomUuid', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('makes valid v4 UUIDs', () => {
    const uuidV4 = z.uuid({ version: 'v4' })

    for (let i = 0; i < 100; i++) {
      expect(uuidV4.safeParse(utilService.getRandomUuid()).success).toBe(true)
    }
  })

  it('makes a different UUID each time', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => utilService.getRandomUuid()))

    expect(uuids.size).toBe(100)
  })

  // The two extremes pin the version and variant bits, whatever the random bytes are
  it.each([
    [0x00, '00000000-0000-4000-8000-000000000000'],
    [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ])('sets the version and variant bits over random byte %i', (byte, uuid) => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint8Array).fill(byte)
      return array
    })

    expect(utilService.getRandomUuid()).toBe(uuid)
  })

  it('works without crypto.randomUUID (an insecure context)', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('randomUUID is not available here')
    })

    expect(z.uuid().safeParse(utilService.getRandomUuid()).success).toBe(true)
  })
})
