import type React from 'react'
import { act, renderHook } from '@testing-library/react'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'
import { describe, expect, it, vi } from 'vitest'
import { useChatText } from './use-chat-text'

function _render(initialText: string | (() => string) = '') {
  const onEnter = vi.fn()
  const hook = renderHook(() => useChatText({ initialText, onEnter }))
  return { onEnter, ...hook }
}

// Only the fields onKeyDown reads
function _keyDown(key: string, { shiftKey = false, isComposing = false } = {}) {
  const preventDefault = vi.fn()
  const ev = { key, shiftKey, nativeEvent: { isComposing }, preventDefault }
  return { ev: ev as unknown as React.KeyboardEvent<HTMLTextAreaElement>, preventDefault }
}

describe('useChatText', () => {
  it('starts from a lazy initial text', () => {
    const { result } = _render(() => 'From the draft')
    expect(result.current.text).toBe('From the draft')
    expect(result.current.textareaProps.value).toBe('From the draft')
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
      const { result } = _render('a'.repeat(800))
      expect(result.current.counterProps).toBeNull()
      expect(result.current.textareaProps['aria-describedby']).toBeUndefined()

      act(() => result.current.setText('a'.repeat(801)))

      const { counterProps, textareaProps } = result.current
      expect(counterProps?.length).toBe(801)
      expect(textareaProps['aria-describedby']).toBe(counterProps?.id)
    })
  })
})
