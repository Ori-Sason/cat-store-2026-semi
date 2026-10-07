import type { LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLoggedInUserStore } from './logged-in-user.store'

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

const store = () => useLoggedInUserStore.getState()

describe('useLoggedInUserStore', () => {
  beforeEach(() => {
    useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
  })

  it('starts as a guest', () => {
    expect(store().loggedInUser).toBeNull()
  })

  it('sets the logged-in user', () => {
    store().setLoggedInUser(_USER)

    expect(store().loggedInUser).toEqual(_USER)
  })

  it('clears the logged-in user', () => {
    store().setLoggedInUser(_USER)
    store().clearLoggedInUser()

    expect(store().loggedInUser).toBeNull()
  })
})
