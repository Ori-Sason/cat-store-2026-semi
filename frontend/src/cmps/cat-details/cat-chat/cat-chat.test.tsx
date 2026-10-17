import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatMsg, LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatChat } from '../../../hooks/use-cat-chat'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { CatChat } from './cat-chat'

// The hook has its own tests. Here it's a stand-in, so each test sets the state it needs
vi.mock('../../../hooks/use-cat-chat')

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
    status: 'ready',
    isOlderAvailable: false,
    isLoadingOlder: false,
    unreadCount: 0,
    loadOlder: vi.fn(),
    retry: vi.fn(),
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
      expect(chat.retry).toHaveBeenCalledOnce()
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
  })
})
