import { render, screen, within } from '@testing-library/react'
import type { ChatMsg } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingChatMsg } from '../../../../models/chat'
import { utilService } from '../../../../services/util.service'
import { ChatLog } from './chat-log'

// "Today" is pinned so the day labels don't depend on when the suite runs
const NOW = new Date(2026, 9, 19, 12, 0).getTime()
const YESTERDAY = new Date(2026, 9, 18, 23, 50).getTime()
const OLDER = new Date(2026, 9, 9, 14, 20).getTime()

function _makeMsg(_id: string, createdAt: number): ChatMsg {
  return {
    _id,
    catId: 'cat-1',
    clientMsgId: `client-${_id}`,
    createdAt,
    updatedAt: createdAt,
    user: { _id: 'user-2', fullname: 'Noam Cohen', isAdmin: false },
    isDeleted: false,
    text: `msg ${_id}`,
  }
}

function _render(msgs: ChatMsg[], pendingMsgs: PendingChatMsg[] = []) {
  render(
    <ChatLog
      msgs={msgs}
      pendingMsgs={pendingMsgs}
      catOwnerId="owner-1"
      isOlderAvailable={false}
      isLoadingOlder={false}
      onLoadOlder={vi.fn()}
      onRetrySendMsg={vi.fn()}
      busyMsgs={{}}
      onUpdateMsg={vi.fn(async () => true)}
      onRemoveMsg={vi.fn()}
    />,
  )
}

function _getDayTexts(label: string) {
  return within(screen.getByRole('region', { name: label }))
    .getAllByRole('article')
    .map((row) => row.querySelector('.words')?.textContent)
}

// Only Date is faked: user-event and React's scheduler still get real timers
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ChatLog', () => {
  describe('the day dividers', () => {
    it('labels today, yesterday and an older day, in time order', () => {
      _render([_makeMsg('a', OLDER), _makeMsg('b', YESTERDAY), _makeMsg('c', NOW - 60_000)])

      const labels = screen.getAllByRole('region').map((day) => day.getAttribute('aria-label'))
      expect(labels).toEqual([utilService.formatDate(OLDER), 'Yesterday', 'Today'])
    })

    it('puts the msgs of one day under one divider', () => {
      _render([_makeMsg('a', YESTERDAY - 60_000), _makeMsg('b', YESTERDAY), _makeMsg('c', NOW)])

      expect(_getDayTexts('Yesterday')).toEqual(['msg a', 'msg b'])
      expect(_getDayTexts('Today')).toEqual(['msg c'])
    })

    // A pending msg was sent just now, so it joins today's group, not a second "Today"
    it('adds a pending msg to the last day', () => {
      const pendingMsg: PendingChatMsg = {
        catId: 'cat-1',
        clientMsgId: 'client-p',
        createdAt: NOW,
        updatedAt: NOW,
        user: { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false },
        isDeleted: false,
        text: 'msg p',
        sendStatus: 'sending',
      }
      _render([_makeMsg('a', NOW - 60_000)], [pendingMsg])

      expect(screen.getAllByRole('region', { name: 'Today' })).toHaveLength(1)
      expect(_getDayTexts('Today')).toEqual(['msg a', 'msg p'])
    })
  })
})
