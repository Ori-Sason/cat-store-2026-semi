import { render, screen } from '@testing-library/react'
import type { ChatMsg, LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ChatMsgPreview } from './chat-msg-preview'

const AUTHOR: LoggedInUser = {
  _id: 'user-1',
  username: 'maya',
  fullname: 'Maya Levi',
  isAdmin: false,
}
const OTHER_USER: LoggedInUser = { ...AUTHOR, _id: 'user-2', username: 'noam' }
const CAT_OWNER_ID = 'owner-1'

const MSG: ChatMsg = {
  _id: 'msg-1',
  catId: 'cat-1',
  clientMsgId: 'client-1',
  createdAt: new Date(2026, 9, 9, 14, 20).getTime(),
  updatedAt: new Date(2026, 9, 9, 14, 20).getTime(),
  user: { _id: AUTHOR._id, fullname: AUTHOR.fullname, isAdmin: false },
  isDeleted: false,
  text: 'Is she ok with dogs?',
}

function _render(msg: ChatMsg, loggedInUser: LoggedInUser | null = null) {
  useLoggedInUserStore.setState({ loggedInUser })
  const { container } = render(<ChatMsgPreview msg={msg} catOwnerId={CAT_OWNER_ID} />)
  // From this render's container: a test may render twice
  return container.querySelector('article')
}

function _byAuthor(user: ChatMsg['user']): ChatMsg {
  return { ...MSG, user }
}

beforeEach(() => {
  useLoggedInUserStore.setState({ loggedInUser: null })
})

describe('ChatMsgPreview', () => {
  describe('the user chips', () => {
    it('shows Owner on a msg by the cat owner', () => {
      _render(_byAuthor({ _id: CAT_OWNER_ID, fullname: 'Dana Katz', isAdmin: false }))
      expect(screen.getByText('Owner')).toBeInTheDocument()
      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })

    it('shows Admin on a msg by an admin', () => {
      _render(_byAuthor({ _id: 'admin-1', fullname: 'Admin User', isAdmin: true }))
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    })

    it('shows no chips on a msg by a regular user', () => {
      _render(MSG, OTHER_USER)
      expect(screen.queryByText('Owner')).not.toBeInTheDocument()
      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })

    it('never shows You, not even on the viewer’s own msg', () => {
      _render(MSG, AUTHOR)
      expect(screen.queryByText('You')).not.toBeInTheDocument()
    })

    it('shows no chips and "[Deleted User]" when the author is gone', () => {
      _render(_byAuthor(null), AUTHOR)
      expect(screen.getByText('[Deleted User]')).toBeInTheDocument()
      expect(screen.queryByText('Owner')).not.toBeInTheDocument()
      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })
  })

  describe('the own-row style', () => {
    it('marks the viewer’s own msg, with a hidden "(you)" for screen readers', () => {
      const row = _render(MSG, AUTHOR)
      expect(row).toHaveClass('is-own')
      expect(screen.getByText('(you)', { exact: false })).toHaveClass('visually-hidden')
    })

    it('leaves out another user’s msg', () => {
      expect(_render(MSG, OTHER_USER)).not.toHaveClass('is-own')
    })

    it('leaves out a guest’s view', () => {
      expect(_render(MSG, null)).not.toHaveClass('is-own')
    })

    // A guest has no _id, and a gone author has none either: both undefined must not match
    it('leaves out a msg whose author is gone, for a guest and a logged-in viewer', () => {
      expect(_render(_byAuthor(null), null)).not.toHaveClass('is-own')
      expect(_render(_byAuthor(null), AUTHOR)).not.toHaveClass('is-own')
    })
  })

  describe('the saved states', () => {
    it('shows "Edited at" with the edit time when updatedAt is past createdAt', () => {
      _render({ ...MSG, updatedAt: new Date(2026, 9, 9, 14, 32).getTime() })
      expect(screen.getByText('Edited at 14:32')).toBeInTheDocument()
    })

    it('shows no "Edited at" on a msg never edited', () => {
      _render(MSG)
      expect(screen.queryByText(/Edited at/)).not.toBeInTheDocument()
    })

    it('shows a tombstone with the header kept and no "Edited at"', () => {
      const { text: _text, ...rest } = MSG
      _render({ ...rest, isDeleted: true, updatedAt: MSG.updatedAt + 60_000 })
      expect(screen.getByText('Message deleted')).toBeInTheDocument()
      expect(screen.getByText('Maya Levi')).toBeInTheDocument()
      expect(screen.getByText('14:20')).toBeInTheDocument()
      expect(screen.queryByText(/Edited at/)).not.toBeInTheDocument()
    })
  })
})
