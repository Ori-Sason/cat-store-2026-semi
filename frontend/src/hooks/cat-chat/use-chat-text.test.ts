import type React from 'react'
import { renderHook } from '@testing-library/react'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'
import { describe, expect, it, vi } from 'vitest'
import { useChatText } from './use-chat-text'

function _render(text = '') {
  const onTextChange = vi.fn()
  const onEnter = vi.fn()
  const hook = renderHook((props) => useChatText({ ...props, onTextChange, onEnter }), {
    initialProps: { text },
  })
  return { onTextChange, onEnter, ...hook }
}

// Only the fields onKeyDown reads
function _keyDown(key: string, { shiftKey = false, isComposing = false } = {}) {
  const preventDefault = vi.fn()
  const ev = { key, shiftKey, nativeEvent: { isComposing }, preventDefault }
  return { ev: ev as unknown as React.KeyboardEvent<HTMLTextAreaElement>, preventDefault }
}

describe('useChatText', () => {
  it('shows the caller’s text and hands each change back to it', () => {
    const { result, onTextChange } = _render('Hi')
    expect(result.current.textareaProps.value).toBe('Hi')

    const ev = { target: { value: 'Hi there' } } as React.ChangeEvent<HTMLTextAreaElement>
    result.current.textareaProps.onChange(ev)

    expect(onTextChange).toHaveBeenCalledExactlyOnceWith('Hi there')
  })

  describe('Enter', () => {
    it('calls onEnter and stops the new line', () => {
      const { result, onEnter } = _render()
      const { ev, preventDefault } = _keyDown('Enter')

      result.current.textareaProps.onKeyDown(ev)

      expect(onEnter).toHaveBeenCalledOnce()
      expect(preventDefault).toHaveBeenCalledOnce()
    })

    it.each([
      ['Shift+Enter', _keyDown('Enter', { shiftKey: true })],
      ['Enter during an IME composition', _keyDown('Enter', { isComposing: true })],
      ['another key', _keyDown('a')],
    ])('leaves %s to the textarea', (_label, { ev, preventDefault }) => {
      const { result, onEnter } = _render()

      result.current.textareaProps.onKeyDown(ev)

      expect(onEnter).not.toHaveBeenCalled()
      expect(preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('validity', () => {
    it.each([
      ['empty', '', false],
      ['only spaces', '   ', false],
      ['a msg', 'Hi', true],
      ['at the cap', 'a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH), true],
      ['past the cap', 'a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH + 1), false],
    ])('%s → isValid %s', (_label, text, isValid) => {
      const { result } = _render(text)
      expect(result.current.isValid).toBe(isValid)
    })
  })

  describe('the counter', () => {
    it('is hidden up to 800 chars, then shown and linked to the textarea', () => {
      const { result, rerender } = _render('a'.repeat(800))
      expect(result.current.counterProps).toBeNull()
      expect(result.current.textareaProps['aria-describedby']).toBeUndefined()

      rerender({ text: 'a'.repeat(801) })

      const { counterProps, textareaProps } = result.current
      expect(counterProps?.length).toBe(801)
      expect(textareaProps['aria-describedby']).toBe(counterProps?.id)
    })
  })
})
