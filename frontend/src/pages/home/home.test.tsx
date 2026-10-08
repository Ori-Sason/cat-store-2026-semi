import { render, screen } from '@testing-library/react'
import type { LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { Home } from './home'

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

function _render() {
  const router = createMemoryRouter([{ path: '/', element: <Home /> }])
  render(<RouterProvider router={router} />)
}

// "Browse cats →" is in the hero and in How it works - the hero's is the first
function _getLink(name: string) {
  return screen.getAllByRole('link', { name })[0]!
}

describe('Home', () => {
  afterEach(() => {
    useLoggedInUserStore.getState().clearLoggedInUser()
  })

  it('shows a guest the browse, login and signup links', () => {
    _render()

    expect(screen.getByText('Browse · Meet · Pick up')).toBeInTheDocument()
    expect(_getLink('Browse cats →')).toHaveAttribute('href', '/cat')
    expect(screen.getAllByRole('link', { name: 'Log in' })).toHaveLength(2) // hero + CTA card
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.getByRole('heading', { name: 'Got a cat to list?' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '+ Add a cat' })).not.toBeInTheDocument()
  })

  it('greets a logged-in user by first name and offers Add a cat instead of login', () => {
    useLoggedInUserStore.getState().setLoggedInUser(_USER)
    _render()

    expect(screen.getByText('Welcome back, Ori')).toBeInTheDocument()
    expect(_getLink('Browse cats →')).toHaveAttribute('href', '/cat')
    const addLinks = screen.getAllByRole('link', { name: '+ Add a cat' })
    expect(addLinks).toHaveLength(2) // hero + CTA card
    for (const link of addLinks) expect(link).toHaveAttribute('href', '/cat/new')
    expect(screen.getByRole('heading', { name: 'Got a cat to list, Ori?' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument()
  })

  it('links every label chip to the list filtered by that label', () => {
    _render()

    expect(screen.getByRole('link', { name: 'Calm' })).toHaveAttribute('href', '/cat?labels=Calm')
    // Multi-word labels go through URLSearchParams encoding, the same as the filter bar
    expect(screen.getByRole('link', { name: 'Good with kids' })).toHaveAttribute(
      'href',
      '/cat?labels=Good+with+kids',
    )
    expect(
      screen.getAllByRole('listitem').filter((li) => li.querySelector('.label-chip')),
    ).toHaveLength(10)
  })

  it('tags the Meet step as Soon, with no link', () => {
    _render()

    const meet = screen.getByRole('heading', { name: 'Meet Soon' }).closest('li')!
    expect(meet.querySelector('a')).toBeNull()
  })
})
