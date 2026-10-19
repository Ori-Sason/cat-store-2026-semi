import type { ChatTyping, UserRef } from '@cat-store/shared'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socketService } from '../../../services/socket.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import {
  CAT_ID,
  OTHER_CAT_ID,
  VIEWER,
  renderChat,
  serverEmit,
  setupChatTest,
} from './chat-test.helper'
import { TYPER_TIMEOUT_MS, TYPING_IDLE_MS, TYPING_THROTTLE_MS } from './typing'

vi.mock('../../../services/socket.service')
vi.mock('../../../services/chat.service')
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => vi.fn(),
}))

setupChatTest()

const NOAM: UserRef = { _id: 'user-2', fullname: 'Noam Cohen', isAdmin: false }
const DANA: UserRef = { _id: 'user-3', fullname: 'Dana Katz', isAdmin: false }

// No waitFor here: it polls on setTimeout, which the fake clock never fires. The join's ack is a
// resolved mock, and typing doesn't wait on the first page, so a closed chat is enough
beforeEach(() => {
  vi.useFakeTimers()
  useLoggedInUserStore.setState({ loggedInUser: VIEWER })
})

afterEach(() => {
  vi.useRealTimers()
})

// The isTyping of every chat:typing sent, in order
function _sentTyping() {
  return vi
    .mocked(socketService.emit)
    .mock.calls.filter(([event]) => event === 'chat:typing')
    .map(([, payload]) => (payload as { isTyping: boolean }).isTyping)
}

function _serverTyping(user: UserRef, isTyping: boolean, catId = CAT_ID) {
  act(() => serverEmit('chat:typing', { catId, user, isTyping } satisfies ChatTyping))
}

function _advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms))
}

describe('useCatChat typing, sent', () => {
  it('sends true on the first keystroke, then at most once per throttle window', () => {
    const { result } = renderChat()

    act(() => result.current.reportTyping('H'))
    _advance(TYPING_THROTTLE_MS - 1)
    act(() => result.current.reportTyping('Hi'))

    expect(_sentTyping()).toEqual([true])
    expect(socketService.emit).toHaveBeenCalledWith('chat:typing', {
      catId: CAT_ID,
      isTyping: true,
    })
  })

  // The repeat refreshes the receivers' timeout during a long msg
  it('sends true again once the throttle window has passed', () => {
    const { result } = renderChat()

    act(() => result.current.reportTyping('H'))
    _advance(TYPING_THROTTLE_MS)
    act(() => result.current.reportTyping('Hi'))

    expect(_sentTyping()).toEqual([true, true])
  })

  it('sends false after the idle wait, restarted by every keystroke', () => {
    const { result } = renderChat()

    act(() => result.current.reportTyping('H'))
    _advance(TYPING_IDLE_MS - 1)
    act(() => result.current.reportTyping('Hi'))
    _advance(TYPING_IDLE_MS - 1)
    expect(_sentTyping()).not.toContain(false)

    _advance(1)

    expect(_sentTyping().at(-1)).toBe(false)
  })

  it('sends false at once when the text is emptied, and nothing more after', () => {
    const { result } = renderChat()

    act(() => result.current.reportTyping('H'))
    act(() => result.current.reportTyping(''))
    _advance(TYPING_IDLE_MS)

    expect(_sentTyping()).toEqual([true, false])
  })

  it('sends nothing for whitespace only', () => {
    const { result } = renderChat()
    act(() => result.current.reportTyping('  '))
    expect(_sentTyping()).toEqual([])
  })

  it('sends false before the msg on send', () => {
    const { result } = renderChat()

    act(() => result.current.reportTyping('Hi'))
    act(() => result.current.sendMsg('Hi'))

    expect(_sentTyping()).toEqual([true, false])
    const falseOrder = vi.mocked(socketService.emit).mock.invocationCallOrder.at(-1)!
    const addCallIndex = vi
      .mocked(socketService.emitWithAck)
      .mock.calls.findIndex(([event]) => event === 'chat:msg-add')
    const addOrder = vi.mocked(socketService.emitWithAck).mock.invocationCallOrder[addCallIndex]
    expect(falseOrder).toBeLessThan(addOrder)
  })

  it('sends no false on a send without typing first', () => {
    const { result } = renderChat()
    act(() => result.current.sendMsg('Hi'))
    expect(_sentTyping()).toEqual([])
  })

  // chat:typing needs room membership: after the leave, the server would drop it
  it('sends false before chat:leave on unmount while typing', () => {
    const { result, unmount } = renderChat()
    act(() => result.current.reportTyping('Hi'))

    unmount()

    const events = vi
      .mocked(socketService.emit)
      .mock.calls.map(([event, payload]) => [event, (payload as { isTyping?: boolean }).isTyping])
    expect(events.slice(-2)).toEqual([
      ['chat:typing', false],
      ['chat:leave', undefined],
    ])
  })

  it('sends no typing on unmount when not typing', () => {
    const { unmount } = renderChat()
    unmount()
    expect(_sentTyping()).toEqual([])
  })

  it('sends nothing for a guest', () => {
    useLoggedInUserStore.setState({ loggedInUser: null })
    const { result } = renderChat()
    act(() => result.current.reportTyping('Hi'))
    expect(_sentTyping()).toEqual([])
  })
})

describe('useCatChat typing, received', () => {
  it('shows a typer on true and drops them on false', () => {
    const { result } = renderChat()

    _serverTyping(NOAM, true)
    expect(result.current.typers).toEqual([NOAM])

    _serverTyping(NOAM, false)
    expect(result.current.typers).toEqual([])
  })

  // The safety net for a false that never comes: a closed tab, a lost connection
  it('drops a typer after the timeout with no refresh', () => {
    const { result } = renderChat()
    _serverTyping(NOAM, true)

    _advance(TYPER_TIMEOUT_MS - 1)
    expect(result.current.typers).toEqual([NOAM])
    _advance(1)

    expect(result.current.typers).toEqual([])
  })

  it('restarts the timeout on a refresh', () => {
    const { result } = renderChat()
    _serverTyping(NOAM, true)
    _advance(TYPER_TIMEOUT_MS - 1)

    _serverTyping(NOAM, true)
    _advance(TYPER_TIMEOUT_MS - 1)

    expect(result.current.typers).toEqual([NOAM])
  })

  it('keeps typers in the order they started, through a refresh', () => {
    const { result } = renderChat()

    _serverTyping(NOAM, true)
    _serverTyping(DANA, true)
    _serverTyping(NOAM, true)

    expect(result.current.typers).toEqual([NOAM, DANA])
  })

  it('drops typing for another cat', () => {
    const { result } = renderChat()
    _serverTyping(NOAM, true, OTHER_CAT_ID)
    expect(result.current.typers).toEqual([])
  })

  it('leaves no timer behind on unmount', () => {
    const { result, unmount } = renderChat()
    act(() => result.current.reportTyping('Hi'))
    _serverTyping(NOAM, true)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
