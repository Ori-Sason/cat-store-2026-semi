import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserMsgStore } from '../../store/user-msg.store'
import { CLOSE_ANIM_MS, DISPLAY_ANIM_MS, UserMessage } from './user-message'

const store = () => useUserMsgStore.getState()

// useNavigation() throws outside a data router, so mount it in a memory one
function _renderUserMessage() {
  const router = createMemoryRouter([{ path: '/', element: <UserMessage /> }])
  render(<RouterProvider router={router} />)
}

function _advanceTime(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

// `.open` is what slides the msg on screen - jsdom doesn't apply the SCSS
function _isOpen() {
  return screen.getByRole('status').closest('.user-message')!.classList.contains('open')
}

describe('UserMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUserMsgStore.setState(useUserMsgStore.getInitialState())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens with the msg text', () => {
    _renderUserMessage()
    act(() => store().showSuccessMsg('Cat saved'))

    expect(screen.getByText('Cat saved')).toBeInTheDocument()
    expect(_isOpen()).toBe(true)
  })

  it('closes after the display time, then clears the msg once the animation ends', () => {
    _renderUserMessage()
    act(() => store().showSuccessMsg('Cat saved'))

    _advanceTime(DISPLAY_ANIM_MS)
    expect(_isOpen()).toBe(false)
    expect(store().msg).not.toBeNull()

    _advanceTime(CLOSE_ANIM_MS)
    expect(store().msg).toBeNull()
  })

  // fireEvent, not user-event: user-event's async wrapper waits on a real setTimeout
  // that Vitest's fake timers never fire, so the test hangs
  it('closes early on the close button', () => {
    _renderUserMessage()
    act(() => store().showErrorMsg('Cat not found'))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(_isOpen()).toBe(false)

    _advanceTime(CLOSE_ANIM_MS)
    expect(store().msg).toBeNull()
  })

  it('restarts the display time when a new msg replaces the current one', () => {
    _renderUserMessage()
    act(() => store().showSuccessMsg('Cat saved'))
    _advanceTime(DISPLAY_ANIM_MS - 1000)

    act(() => store().showSuccessMsg('Cat saved again'))
    _advanceTime(DISPLAY_ANIM_MS - 1000)

    expect(screen.getByText('Cat saved again')).toBeInTheDocument()
    expect(_isOpen()).toBe(true)
  })

  it('shows a queued navigation msg once navigation is idle', () => {
    store().queueSuccessNavigationMsg('Logged in')
    _renderUserMessage()

    expect(screen.getByText('Logged in')).toBeInTheDocument()
    expect(store().navigationMsg).toBeNull()
  })
})
