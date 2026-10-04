import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedCallback } from './use-debounced-callback'

function _render() {
  const fn = vi.fn()
  const hook = renderHook(() => useDebouncedCallback(fn, 300))
  return { fn, ...hook }
}

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls once after the delay, with the last args', () => {
    const { fn, result } = _render()

    act(() => {
      result.current.call('t')
      result.current.call('to')
    })
    expect(result.current.isPending).toBe(true)
    act(() => vi.advanceTimersByTime(299))
    expect(fn).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))

    expect(fn).toHaveBeenCalledExactlyOnceWith('to')
    expect(result.current.isPending).toBe(false)
  })

  it('restarts the timer on a new call', () => {
    const { fn, result } = _render()

    act(() => result.current.call('t'))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.call('to'))
    act(() => vi.advanceTimersByTime(200))
    expect(fn).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(100))

    expect(fn).toHaveBeenCalledExactlyOnceWith('to')
  })

  it('drops a pending call on cancel', () => {
    const { fn, result } = _render()

    act(() => {
      result.current.call('t')
      result.current.cancel()
    })
    act(() => vi.advanceTimersByTime(300))

    expect(fn).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('drops a pending call on unmount', () => {
    const { fn, result, unmount } = _render()

    act(() => result.current.call('t'))
    unmount()
    vi.advanceTimersByTime(300)

    expect(fn).not.toHaveBeenCalled()
  })
})
