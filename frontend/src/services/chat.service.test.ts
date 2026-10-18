import type { ChatMsg } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chatService } from './chat.service'
import { httpService } from './http.service'

vi.mock('./http.service')

const _ENDPOINT = 'cats/cat-1/chat-msgs'

const _MSG: ChatMsg = {
  _id: 'msg-1',
  catId: 'cat-1',
  clientMsgId: 'client-1',
  createdAt: 1,
  updatedAt: 1,
  user: { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false },
  isDeleted: false,
  text: 'Hi',
}

describe('chatService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getOlderPage', () => {
    it('gets the newest page without a cursor', async () => {
      const page = { msgs: [_MSG], nextBeforeId: null }
      vi.mocked(httpService.get).mockResolvedValue(page)

      expect(await chatService.getOlderPage('cat-1')).toEqual(page)
      expect(httpService.get).toHaveBeenCalledWith(_ENDPOINT, undefined)
    })

    it('gets the page before a msg', async () => {
      const page = { msgs: [_MSG], nextBeforeId: 'msg-1' }
      vi.mocked(httpService.get).mockResolvedValue(page)

      expect(await chatService.getOlderPage('cat-1', 'msg-2')).toEqual(page)
      expect(httpService.get).toHaveBeenCalledWith(_ENDPOINT, { beforeId: 'msg-2' })
    })
  })

  describe('getNewerPage', () => {
    it('gets the page after a msg', async () => {
      const page = { msgs: [_MSG], nextAfterId: null }
      vi.mocked(httpService.get).mockResolvedValue(page)

      expect(await chatService.getNewerPage('cat-1', 'msg-0')).toEqual(page)
      expect(httpService.get).toHaveBeenCalledWith(_ENDPOINT, { afterId: 'msg-0' })
    })
  })

  describe('the draft', () => {
    beforeEach(() => {
      sessionStorage.clear()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('saves, reads and removes the draft of one cat', () => {
      chatService.saveDraft('cat-1', 'Is she ok with dogs?')

      expect(chatService.getDraft('cat-1')).toBe('Is she ok with dogs?')
      expect(chatService.getDraft('cat-2')).toBeNull()

      chatService.removeDraft('cat-1')

      expect(chatService.getDraft('cat-1')).toBeNull()
    })

    it('keeps it under chatDraft:<catId>', () => {
      chatService.saveDraft('cat-1', 'Hi')
      expect(sessionStorage.getItem('chatDraft:cat-1')).toBe('Hi')
    })

    // Blocked site data: reading the sessionStorage global throws, before any method runs
    it("doesn't throw when storage is blocked", () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('Access is denied for this document', 'SecurityError')
      })

      expect(() => chatService.saveDraft('cat-1', 'Hi')).not.toThrow()
      expect(chatService.getDraft('cat-1')).toBeNull()
      expect(() => chatService.removeDraft('cat-1')).not.toThrow()
    })

    it("doesn't throw when the quota is full", () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded', 'QuotaExceededError')
      })

      expect(() => chatService.saveDraft('cat-1', 'Hi')).not.toThrow()
      expect(chatService.getDraft('cat-1')).toBeNull()
    })
  })
})
