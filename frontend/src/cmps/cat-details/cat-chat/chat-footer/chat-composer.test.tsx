import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './chat-composer'

function _render({ isDisabled = false, initialText = '' } = {}) {
  const onSendMsg = vi.fn()
  render(<ComposerHost initialText={initialText} isDisabled={isDisabled} onSendMsg={onSendMsg} />)
  return { onSendMsg, textarea: screen.getByRole('textbox', { name: 'Message' }) }
}

// CatChat owns the composer's text. This stands in for it
function ComposerHost({
  initialText,
  isDisabled,
  onSendMsg,
}: {
  initialText: string
  isDisabled: boolean
  onSendMsg: (text: string) => void
}) {
  const [text, setText] = useState(initialText)
  return (
    <ChatComposer
      text={text}
      onTextChange={setText}
      isDisabled={isDisabled}
      onSendMsg={onSendMsg}
    />
  )
}

describe('ChatComposer', () => {
  describe('sending', () => {
    it('sends the trimmed text on Enter and clears the field', async () => {
      const { onSendMsg, textarea } = _render()

      await userEvent.type(textarea, '  Is she ok with dogs?  {Enter}')

      expect(onSendMsg).toHaveBeenCalledExactlyOnceWith('Is she ok with dogs?')
      expect(textarea).toHaveValue('')
      expect(textarea).toHaveFocus()
    })

    it('sends on the send button too, and gives the focus back to the field', async () => {
      const { onSendMsg, textarea } = _render()

      await userEvent.type(textarea, 'Hi')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(onSendMsg).toHaveBeenCalledExactlyOnceWith('Hi')
      expect(textarea).toHaveFocus()
    })

    it('adds a line on Shift+Enter instead of sending', async () => {
      const { onSendMsg, textarea } = _render()

      await userEvent.type(textarea, 'Hi{Shift>}{Enter}{/Shift}there')

      expect(onSendMsg).not.toHaveBeenCalled()
      expect(textarea).toHaveValue('Hi\nthere')
    })
  })

  describe('validation', () => {
    it('sends nothing while the field is empty or only spaces', async () => {
      const { onSendMsg, textarea } = _render()
      const sendBtn = screen.getByRole('button', { name: 'Send' })
      expect(sendBtn).toBeDisabled()

      await userEvent.type(textarea, '   {Enter}')

      expect(sendBtn).toBeDisabled()
      expect(onSendMsg).not.toHaveBeenCalled()
    })

    // No maxLength: a long paste stays whole, and the user shortens it
    it('takes text past the max length, but turns the counter red and sends nothing', async () => {
      const { onSendMsg, textarea } = _render()

      await userEvent.click(textarea)
      await userEvent.paste('a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH + 1))
      await userEvent.keyboard('{Enter}')

      expect(textarea).toHaveValue('a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH + 1))
      expect(screen.getByText('1001 / 1000')).toHaveClass('is-over')
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      expect(onSendMsg).not.toHaveBeenCalled()
    })

    it('shows the counter only past 800 chars', async () => {
      const { textarea } = _render()

      await userEvent.click(textarea)
      await userEvent.paste('a'.repeat(800))
      expect(screen.queryByText(/\/ 1000/)).not.toBeInTheDocument()

      await userEvent.paste('a')
      expect(screen.getByText('801 / 1000')).toBeInTheDocument()
      expect(textarea).toHaveAccessibleDescription('801 / 1000')
    })

    it('sends nothing while disabled', () => {
      const { textarea } = _render({ isDisabled: true })
      expect(textarea).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    })
  })
})
