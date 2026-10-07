import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { LoginSignupForm, type LoginSignupMode } from './login-signup-form'

const _VALID_PASSWORD = 'Secret1!'

function _render(mode: LoginSignupMode) {
  const onSubmit = vi.fn()
  render(
    <MemoryRouter>
      <LoginSignupForm
        mode={mode}
        isSubmitting={false}
        otherModeTo={mode === 'login' ? '/signup' : '/login'}
        onSubmit={onSubmit}
      />
    </MemoryRouter>,
  )
  return { onSubmit, user: userEvent.setup() }
}

describe('LoginSignupForm', () => {
  it('shows username and password only on login', () => {
    _render('login')

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup')
  })

  it('adds full name and confirm password on signup', () => {
    _render('signup')

    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('logs in with a lowercased username and isRemembered', async () => {
    const { onSubmit, user } = _render('login')

    await user.type(screen.getByLabelText('Username'), 'Ori')
    await user.type(screen.getByLabelText('Password'), 'anything')
    await user.click(screen.getByRole('checkbox', { name: 'Remember me' }))
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(onSubmit).toHaveBeenCalledWith({
      username: 'ori',
      password: 'anything',
      isRemembered: true,
    })
  })

  it('shows required errors on an empty login and does not submit', async () => {
    const { onSubmit, user } = _render('login')

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByText('Username is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a field error after leaving the field', async () => {
    const { user } = _render('signup')

    await user.type(screen.getByLabelText('Password'), 'short')
    await user.tab()

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a mismatch error on confirm password, even while other fields are invalid', async () => {
    const { onSubmit, user } = _render('signup')

    await user.type(screen.getByLabelText('Password'), _VALID_PASSWORD)
    await user.type(screen.getByLabelText('Confirm password'), 'Different1!')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument()
    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('signs up without confirmPassword in the payload, and isRemembered false by default', async () => {
    const { onSubmit, user } = _render('signup')

    await user.type(screen.getByLabelText('Full name'), 'Ori Sason')
    await user.type(screen.getByLabelText('Username'), 'ori_s')
    await user.type(screen.getByLabelText('Password'), _VALID_PASSWORD)
    await user.type(screen.getByLabelText('Confirm password'), _VALID_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(onSubmit).toHaveBeenCalledWith({
      fullname: 'Ori Sason',
      username: 'ori_s',
      password: _VALID_PASSWORD,
      isRemembered: false,
    })
  })
})
