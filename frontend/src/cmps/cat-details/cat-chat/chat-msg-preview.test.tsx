import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatMsg, LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMsgBusyAction } from '../../../hooks/use-cat-chat/chat-state'
import type { PendingChatMsg } from '../../../models/chat'
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

function _render(
  msg: ChatMsg | PendingChatMsg,
  loggedInUser: LoggedInUser | null = null,
  onRetry?: () => void,
) {
  useLoggedInUserStore.setState({ loggedInUser })
  const { container } = render(
    <ChatMsgPreview msg={msg} catOwnerId={CAT_OWNER_ID} onRetry={onRetry} />,
  )
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

  describe('the pending states', () => {
    function _pending(sendStatus: PendingChatMsg['sendStatus']): PendingChatMsg {
      const { _id: _unused, ...rest } = MSG as Extract<ChatMsg, { isDeleted: false }>
      const user = { _id: AUTHOR._id, fullname: AUTHOR.fullname, isAdmin: false }
      return { ...rest, user, sendStatus }
    }

    it('shows "Sending…" on the own row while the ack is on its way', () => {
      const row = _render(_pending('sending'), AUTHOR)
      expect(row).toHaveClass('is-own', 'is-pending')
      expect(screen.getByText('Sending…')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('offers a retry on a failed msg to its author', async () => {
      const onRetry = vi.fn()
      const row = _render(_pending('failed'), AUTHOR, onRetry)
      expect(row).toHaveClass('is-failed')
      expect(screen.queryByText('Sending…')).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Not sent. Tap to retry' }))

      expect(onRetry).toHaveBeenCalledOnce()
    })

    // After an expired session: the text stays on screen, but a guest can't send it
    it('keeps a failed msg without a retry once the viewer is a guest', () => {
      _render(_pending('failed'), null)
      expect(screen.getByText('Not sent')).toBeInTheDocument()
      expect(screen.getByText(MSG.text)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('the actions', () => {
    const ADMIN: LoggedInUser = { ...OTHER_USER, _id: 'admin-1', username: 'admin', isAdmin: true }

    function _renderEditable(
      msg: ChatMsg | PendingChatMsg,
      loggedInUser: LoggedInUser | null,
      { busyAction, isSaved = true }: { busyAction?: ChatMsgBusyAction; isSaved?: boolean } = {},
    ) {
      useLoggedInUserStore.setState({ loggedInUser })
      const onUpdate = vi.fn(async (_text: string) => isSaved)
      const onRemove = vi.fn()
      const { rerender } = render(
        <ChatMsgPreview
          msg={msg}
          catOwnerId={CAT_OWNER_ID}
          busyAction={busyAction}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />,
      )
      return { onUpdate, onRemove, rerender }
    }

    async function _openMenu() {
      await userEvent.click(screen.getByRole('button', { name: 'Message actions' }))
    }

    async function _openEdit() {
      await _openMenu()
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      return screen.getByRole('textbox', { name: 'Edit message' })
    }

    it('offers Edit and Delete on the viewer’s own msg', async () => {
      _renderEditable(MSG, AUTHOR)
      await _openMenu()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('offers an admin Delete only on someone else’s msg', async () => {
      _renderEditable(MSG, ADMIN)
      await _openMenu()
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('offers an admin Delete on a msg whose author is gone', async () => {
      _renderEditable(_byAuthor(null), ADMIN)
      await _openMenu()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it.each([
      ['another user’s msg', MSG, OTHER_USER],
      ['a guest', MSG, null],
    ] as const)('shows no ⋮ on %s', (_label, msg, loggedInUser) => {
      _renderEditable(msg, loggedInUser)
      expect(screen.queryByRole('button', { name: 'Message actions' })).not.toBeInTheDocument()
    })

    it('shows no ⋮ on a tombstone, even to an admin', () => {
      const { text: _text, ...rest } = MSG
      _renderEditable({ ...rest, isDeleted: true }, ADMIN)
      expect(screen.queryByRole('button', { name: 'Message actions' })).not.toBeInTheDocument()
    })

    it('asks for the delete confirm through onRemove', async () => {
      const { onRemove } = _renderEditable(MSG, AUTHOR)
      await _openMenu()
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(onRemove).toHaveBeenCalledOnce()
    })

    it('dims a busy msg and disables its ⋮', () => {
      const { onRemove } = _renderEditable(MSG, AUTHOR, { busyAction: 'removing' })
      expect(screen.getByRole('article')).toHaveClass('is-busy')
      expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: 'Message actions' })).toBeDisabled()
      expect(screen.getByText('Deleting…')).toBeInTheDocument()
      expect(onRemove).not.toHaveBeenCalled()
    })

    describe('inline edit', () => {
      it('opens prefilled and focused, in place of the text and the ⋮', async () => {
        _renderEditable({ ...MSG, updatedAt: MSG.updatedAt + 60_000 }, AUTHOR)
        const textarea = await _openEdit()

        expect(textarea).toHaveValue(MSG.text)
        expect(textarea).toHaveFocus()
        expect(screen.queryByRole('button', { name: 'Message actions' })).not.toBeInTheDocument()
        expect(screen.queryByText(/Edited at/)).not.toBeInTheDocument()
      })

      it('saves the trimmed text, and closes once saved', async () => {
        const { onUpdate } = _renderEditable(MSG, AUTHOR)
        const textarea = await _openEdit()

        await userEvent.clear(textarea)
        await userEvent.type(textarea, '  Is he ok with dogs?  {Enter}')

        expect(onUpdate).toHaveBeenCalledExactlyOnceWith('Is he ok with dogs?')
        expect(screen.queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
      })

      it('stays open with the typed text when the save fails', async () => {
        _renderEditable(MSG, AUTHOR, { isSaved: false })
        const textarea = await _openEdit()

        await userEvent.type(textarea, ' Or cats?')
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(screen.getByRole('textbox', { name: 'Edit message' })).toHaveValue(
          `${MSG.text} Or cats?`,
        )
      })

      it('closes without a save when the text is unchanged', async () => {
        const { onUpdate } = _renderEditable(MSG, AUTHOR)
        await _openEdit()

        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(onUpdate).not.toHaveBeenCalled()
        expect(screen.queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
      })

      it('turns Save off on an empty text', async () => {
        _renderEditable(MSG, AUTHOR)
        const textarea = await _openEdit()

        await userEvent.clear(textarea)
        await userEvent.type(textarea, '   ')

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      })

      it('cancels on Escape and keeps the panel’s Escape from firing', async () => {
        const onPanelKeyDown = vi.fn()
        useLoggedInUserStore.setState({ loggedInUser: AUTHOR })
        render(
          <div onKeyDown={onPanelKeyDown}>
            <ChatMsgPreview msg={MSG} catOwnerId={CAT_OWNER_ID} onUpdate={vi.fn()} />
          </div>,
        )
        await _openEdit()

        await userEvent.keyboard('{Escape}')

        expect(screen.queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
        expect(screen.getByText(MSG.text)).toBeInTheDocument()
        expect(onPanelKeyDown).not.toHaveBeenCalled()
      })

      it('shows "Saving edit…" and locks the editor while the ack is on its way', async () => {
        const { rerender } = _renderEditable(MSG, AUTHOR)
        await _openEdit()

        rerender(<ChatMsgPreview msg={MSG} catOwnerId={CAT_OWNER_ID} busyAction="updating" />)

        expect(screen.getByText('Saving edit…')).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Edit message' })).toHaveAttribute('readonly')
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      })

      it('closes when the msg is deleted meanwhile', async () => {
        const { rerender } = _renderEditable(MSG, AUTHOR)
        await _openEdit()
        const { text: _text, ...rest } = MSG

        rerender(<ChatMsgPreview msg={{ ...rest, isDeleted: true }} catOwnerId={CAT_OWNER_ID} />)

        expect(screen.queryByRole('textbox', { name: 'Edit message' })).not.toBeInTheDocument()
        expect(screen.getByText('Message deleted')).toBeInTheDocument()
      })
    })
  })
})
