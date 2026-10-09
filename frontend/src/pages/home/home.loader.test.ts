import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catService } from '../../services/cat.service'
import { homeLoader } from './home.loader'

vi.mock('../../services/cat.service')

// Vitest runs in Node, but the FE tsconfig has no Node types (adding them would leak into
// app code). This is the slice of process the unhandled-rejection test needs
interface _NodeProcess {
  on(event: 'unhandledRejection', listener: () => void): void
  off(event: 'unhandledRejection', listener: () => void): void
}
const _process = (globalThis as unknown as { process: _NodeProcess }).process

describe('homeLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // If the loader awaited, it would hang here and navigation to / would wait on the API
  it('returns both promises un-awaited', () => {
    const newestCats = new Promise<never>(() => {})
    const labelStats = new Promise<never>(() => {})
    vi.mocked(catService.query).mockReturnValue(newestCats)
    vi.mocked(catService.getLabelStats).mockReturnValue(labelStats)

    const result = homeLoader()

    expect(result.newestCats).toBe(newestCats)
    expect(result.labelStats).toBe(labelStats)
  })

  // Node flags a rejection that has no handler once the microtasks drain. Without the loader's
  // no-op catch, both calls would land here before anything awaits them.
  // Plain functions, not vi.fn: a vi.fn calls .then on the promise it returns (to record
  // settledResults), which would count as a handler and hide the bug
  it('keeps a failed call from going unhandled when nothing awaits it', async () => {
    const { query, getLabelStats } = catService
    const onUnhandled = vi.fn()
    _process.on('unhandledRejection', onUnhandled)
    catService.query = () => Promise.reject(new Error('down'))
    catService.getLabelStats = () => Promise.reject(new Error('down'))

    try {
      const result = homeLoader()
      await new Promise((resolve) => setTimeout(resolve)) // a macrotask: past Node's check

      expect(onUnhandled).not.toHaveBeenCalled()
      // Still rejects for <Await>
      await expect(result.newestCats).rejects.toThrow('down')
      await expect(result.labelStats).rejects.toThrow('down')
    } finally {
      _process.off('unhandledRejection', onUnhandled)
      Object.assign(catService, { query, getLabelStats })
    }
  })

  it('asks for the 4 newest cats on the default filter', () => {
    vi.mocked(catService.query).mockReturnValue(new Promise(() => {}))
    vi.mocked(catService.getLabelStats).mockReturnValue(new Promise(() => {}))

    homeLoader()

    expect(catService.query).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, limit: 4 })
  })
})
