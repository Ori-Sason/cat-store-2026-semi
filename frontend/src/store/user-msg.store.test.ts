import { beforeEach, describe, expect, it } from 'vitest'
import { useUserMsgStore } from './user-msg.store'

const store = () => useUserMsgStore.getState()

describe('useUserMsgStore', () => {
  beforeEach(() => {
    useUserMsgStore.setState(useUserMsgStore.getInitialState())
  })

  it('shows a success msg', () => {
    store().showSuccessMsg('Cat saved')

    expect(store().msg).toMatchObject({ txt: 'Cat saved', type: 'success' })
  })

  it('shows an error msg', () => {
    store().showErrorMsg('Cat not found')

    expect(store().msg).toMatchObject({ txt: 'Cat not found', type: 'error' })
  })

  it('gives each msg a new id, even with the same text', () => {
    store().showSuccessMsg('Cat saved')
    const firstId = store().msg?.id
    store().showSuccessMsg('Cat saved')

    expect(store().msg?.id).not.toBe(firstId)
  })

  it('clears the msg', () => {
    store().showSuccessMsg('Cat saved')
    store().clearMsg()

    expect(store().msg).toBeNull()
  })

  it('holds a queued navigation msg without showing it', () => {
    store().queueSuccessNavigationMsg('Logged in')

    expect(store().msg).toBeNull()
    expect(store().navigationMsg).toMatchObject({ txt: 'Logged in', type: 'success' })
  })

  it('moves the queued msg to msg on flush', () => {
    store().queueSuccessNavigationMsg('Logged in')
    const queued = store().navigationMsg
    store().flushNavigationMsg()

    expect(store().msg).toBe(queued)
    expect(store().navigationMsg).toBeNull()
  })

  it('keeps the current msg when flushing an empty queue', () => {
    store().showErrorMsg('Cat not found')
    const current = store().msg
    store().flushNavigationMsg()

    expect(store().msg).toBe(current)
  })
})
