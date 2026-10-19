import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatMsg, LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatChat } from '../../../hooks/cat-chat/use-cat-chat/use-cat-chat'
import type { PendingChatMsg } from '../../../models/chat'
import { chatService } from '../../../services/chat.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { CatChat } from './cat-chat'

// The hook has its own tests. Here it's a stand-in, so each test sets the state it needs
vi.mock('../../../hooks/cat-chat/use-cat-chat/use-cat-chat')

const USER: LoggedInUser = {
  _id: 'user-1',
  username: 'maya',
  fullname: 'Maya Levi',
  isAdmin: false,
}
const CAT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'

const MSG: ChatMsg = {
  _id: 'msg-1',
  catId: CAT_ID,
  clientMsgId: 'client-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  user: { _id: 'user-2', fullname: 'Noam Cohen', isAdmin: false },
  isDeleted: false,
  text: 'Is she ok with dogs?',
}

type CatChatHook = ReturnType<typeof useCatChat>

function _mockChat(overrides: Partial<CatChatHook> = {}) {
  const chat: CatChatHook = {
    msgs: [],
    pendingMsgs: [],
    status: 'ready',
    isOlderAvailable: false,
    isLoadingOlder: false,
    unreadCount: 0,
    busyMsgs: {},
    loadOlder: vi.fn(),
    retryLoadChat: vi.fn(),
    sendMsg: vi.fn(),
    retrySendMsg: vi.fn(),
    updateMsg: vi.fn(),
    removeMsg: vi.fn(),
    ...overrides,
  }
  vi.mocked(useCatChat).mockReturnValue(chat)
  return chat
}

function _render(loggedInUser: LoggedInUser | null = USER) {
  useLoggedInUserStore.setState({ loggedInUser })
  const router = createMemoryRouter(
    [
      {
        path: '/cat/:id',
        element: <CatChat catId={CAT_ID} catName="Mitzi" catOwnerId="owner-1" />,
      },
    ],
    { initialEntries: [`/cat/${CAT_ID}`] },
  )
  render(<RouterProvider router={router} />)
}

async function _open() {
  await userEvent.click(screen.getByRole('button', { name: /open chat/i }))
}

beforeEach(() => {
  vi.mocked(useCatChat).mockReset()
  sessionStorage.clear()
})

describe('CatChat', () => {
  describe('the icon', () => {
    it('shows the unread count on the badge and in its label', () => {
      _mockChat({ unreadCount: 3 })
      _render()
      expect(screen.getByRole('button', { name: 'Open chat, 3 unread' })).toHaveTextContent('3')
    })

    it('caps the badge at 99+', () => {
      _mockChat({ unreadCount: 120 })
      _render()
      expect(screen.getByRole('button', { name: /open chat/i })).toHaveTextContent('99+')
    })

    it('shows no badge with nothing unread', () => {
      _mockChat()
      _render()
      expect(screen.getByRole('button', { name: 'Open chat' })).toHaveTextContent('')
    })
  })

  describe('open and close', () => {
    it('opens the panel in place of the icon, and tells the hook', async () => {
      _mockChat({ msgs: [MSG] })
      _render()
      expect(useCatChat).toHaveBeenLastCalledWith(CAT_ID, false)
      await _open()

      expect(screen.getByRole('region', { name: 'Chat' })).toHaveFocus()
      expect(screen.getByText('About Mitzi')).toBeInTheDocument()
      expect(screen.getByText('Is she ok with dogs?')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /open chat/i })).not.toBeInTheDocument()
      expect(useCatChat).toHaveBeenLastCalledWith(CAT_ID, true)
    })

    it('closes on × and gives the focus back to the icon', async () => {
      _mockChat()
      _render()
      await _open()
      await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))

      expect(screen.queryByRole('region', { name: 'Chat' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /open chat/i })).toHaveFocus()
    })

    it('closes on Escape', async () => {
      _mockChat()
      _render()
      await _open()
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('region', { name: 'Chat' })).not.toBeInTheDocument()
    })

    // The browser closes the popover on Escape but lets the key bubble up to the panel
    it('stays open on an Escape that closes a msg ⋮ menu', async () => {
      _mockChat({ msgs: [{ ...MSG, user: { ...MSG.user!, _id: USER._id } }] })
      _render()
      await _open()
      await userEvent.click(screen.getByRole('button', { name: 'Message actions' }))

      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument()
    })
  })

  describe('the panel body', () => {
    it('shows the skeleton while the first page loads', async () => {
      _mockChat({ status: 'loading' })
      _render()
      await _open()
      expect(screen.getByLabelText('Loading messages')).toBeInTheDocument()
    })

    it('shows the failed join with a retry', async () => {
      const chat = _mockChat({ status: 'error' })
      _render()
      await _open()
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't connect to the chat.")
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(chat.retryLoadChat).toHaveBeenCalledOnce()
    })

    it('shows the empty note on an empty log', async () => {
      _mockChat()
      _render()
      await _open()
      expect(screen.getByText('No messages yet')).toBeInTheDocument()
    })

    it('shows "Load older" only while older msgs exist, and calls the hook', async () => {
      const chat = _mockChat({ msgs: [MSG], isOlderAvailable: true })
      _render()
      await _open()
      await userEvent.click(screen.getByRole('button', { name: 'Load older' }))
      expect(chat.loadOlder).toHaveBeenCalledOnce()
    })
  })

  describe('the guest CTA', () => {
    it('asks a guest to log in, back to this cat after', async () => {
      _mockChat()
      _render(null)
      await _open()
      expect(screen.getByRole('link', { name: 'Log in to chat' })).toHaveAttribute(
        'href',
        `/login?redirectTo=${encodeURIComponent(`/cat/${CAT_ID}`)}`,
      )
    })

    it('shows no CTA to a logged-in user', async () => {
      _mockChat()
      _render()
      await _open()
      expect(screen.queryByRole('link', { name: 'Log in to chat' })).not.toBeInTheDocument()
    })

    it('gives a guest no composer', async () => {
      _mockChat()
      _render(null)
      await _open()
      expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    })
  })

  describe('sending', () => {
    it('starts the composer from the draft an expired session left', async () => {
      chatService.saveDraft(CAT_ID, 'Can I visit on Sunday?')
      _mockChat()
      _render()
      await _open()
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Can I visit on Sunday?')
    })

    // Closing unmounts the composer, so its text lives in the panel
    it('keeps the typed text through a close and a reopen', async () => {
      _mockChat()
      _render()
      await _open()
      await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Half a thought')

      await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))
      await _open()

      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Half a thought')
    })

    it('sends what the composer submits through the hook', async () => {
      const chat = _mockChat()
      _render()
      await _open()
      await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi{Enter}')
      expect(chat.sendMsg).toHaveBeenCalledExactlyOnceWith('Hi')
    })

    // A send before the join ack would be refused
    it('disables the composer until the chat is ready', async () => {
      _mockChat({ status: 'loading' })
      _render()
      await _open()
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    })

    it('shows a pending msg below the saved ones, and a failed one retries through the hook', async () => {
      const failedMsg: PendingChatMsg = {
        catId: CAT_ID,
        clientMsgId: 'client-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        user: { _id: USER._id, fullname: USER.fullname, isAdmin: false },
        isDeleted: false,
        text: 'Can I visit on Sunday?',
        sendStatus: 'failed',
      }
      const chat = _mockChat({ msgs: [MSG], pendingMsgs: [failedMsg] })
      _render()
      await _open()

      const rows = screen.getAllByRole('article')
      expect(rows.map((row) => row.querySelector('.words')?.textContent)).toEqual([
        MSG.text,
        failedMsg.text,
      ])
      await userEvent.click(screen.getByRole('button', { name: 'Not sent. Tap to retry' }))
      expect(chat.retrySendMsg).toHaveBeenCalledExactlyOnceWith('client-2')
    })
  })

  // The editor's own behavior is in chat-msg-preview's tests. This pins the _id the log binds
  describe('the inline edit', () => {
    it('saves through the hook', async () => {
      const ownMsg: ChatMsg = {
        ...MSG,
        user: { _id: USER._id, fullname: USER.fullname, isAdmin: false },
      }
      const chat = _mockChat({ msgs: [ownMsg], updateMsg: vi.fn(async () => true) })
      _render()
      await _open()
      await userEvent.click(screen.getByRole('button', { name: 'Message actions' }))
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

      await userEvent.type(screen.getByRole('textbox', { name: 'Edit message' }), '!{Enter}')

      expect(chat.updateMsg).toHaveBeenCalledExactlyOnceWith(ownMsg._id, `${ownMsg.text}!`)
    })
  })

  describe('the delete confirm', () => {
    const OWN_MSG: ChatMsg = {
      ...MSG,
      user: { _id: USER._id, fullname: USER.fullname, isAdmin: false },
    }

    async function _askToDelete() {
      await _open()
      await userEvent.click(screen.getByRole('button', { name: 'Message actions' }))
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
      return screen.getByRole('alertdialog', { name: 'Delete this message?' })
    }

    it('asks first, with the focus on Cancel and the log inert', async () => {
      const chat = _mockChat({ msgs: [OWN_MSG] })
      _render()
      await _askToDelete()

      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(document.querySelector('.chat-body')).toHaveAttribute('inert')
      expect(screen.getByRole('button', { name: 'Close chat' })).not.toHaveAttribute('inert')
      expect(chat.removeMsg).not.toHaveBeenCalled()
    })

    // So a tap on the wrong row's ⋮ is caught before it's too late
    it('quotes the msg being deleted', async () => {
      _mockChat({ msgs: [OWN_MSG] })
      _render()
      const confirm = await _askToDelete()

      expect(within(confirm).getByText(OWN_MSG.text)).toBeInTheDocument()
      expect(confirm).toHaveAccessibleDescription(expect.stringContaining(OWN_MSG.text))
    })

    it('closes when someone else deletes the msg meanwhile', async () => {
      _mockChat({ msgs: [OWN_MSG] })
      _render()
      await _askToDelete()
      const { text: _text, ...rest } = OWN_MSG

      _mockChat({ msgs: [{ ...rest, isDeleted: true }] })
      // Any re-render reads the hook again: a new copy of the same user is one
      act(() => useLoggedInUserStore.setState({ loggedInUser: { ...USER } }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('removes through the hook on Delete', async () => {
      const chat = _mockChat({ msgs: [OWN_MSG] })
      _render()
      const confirm = await _askToDelete()

      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

      expect(chat.removeMsg).toHaveBeenCalledExactlyOnceWith(OWN_MSG._id)
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(document.querySelector('.chat-body')).not.toHaveAttribute('inert')
    })

    it('gives the focus back to the ⋮ button on Cancel', async () => {
      const chat = _mockChat({ msgs: [OWN_MSG] })
      _render()
      await _askToDelete()

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Message actions' })).toHaveFocus()
      expect(chat.removeMsg).not.toHaveBeenCalled()
    })

    it('cancels on Escape and keeps the panel open', async () => {
      _mockChat({ msgs: [OWN_MSG] })
      _render()
      await _askToDelete()

      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument()
    })

    it('is gone after closing and reopening the panel', async () => {
      _mockChat({ msgs: [OWN_MSG] })
      _render()
      await _askToDelete()

      await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))
      await _open()

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })
})
