import type React from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { loginSchema, type LoginInput, type SignupInput } from '@cat-store/shared'
import { signupFormSchema } from '../../models/user'

export type LoginSignupMode = 'login' | 'signup'

interface LoginSignupForm {
  fullname: string
  username: string
  password: string
  confirmPassword: string
  isRemembered: boolean
}
type TextField = 'fullname' | 'username' | 'password' | 'confirmPassword'

const _EMPTY_FORM: LoginSignupForm = {
  fullname: '',
  username: '',
  password: '',
  confirmPassword: '',
  isRemembered: false,
}

interface LoginSignupFormProps {
  mode: LoginSignupMode
  isSubmitting: boolean
  otherModeTo: string
  onSubmit: (input: LoginInput | SignupInput) => void
}

export const LoginSignupForm: React.FC<LoginSignupFormProps> = ({
  mode,
  isSubmitting,
  otherModeTo,
  onSubmit,
}) => {
  const [form, setForm] = useState(_EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<TextField, boolean>>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const isSignup = mode === 'signup'

  const result = isSignup ? signupFormSchema.safeParse(form) : loginSchema.safeParse(form)
  const fieldErrors: Partial<Record<TextField, string[]>> = result.success
    ? {}
    : z.flattenError(result.error).fieldErrors

  function getError(field: TextField) {
    return touched[field] || isSubmitted ? fieldErrors[field]?.[0] : undefined
  }

  function getTextFieldProps(field: TextField) {
    const error = getError(field)
    return {
      id: `login-signup-${field}`,
      value: form[field],
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: ev.target.value })),
      onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
      'aria-invalid': !!error,
      'aria-describedby': error ? `login-signup-${field}-error` : undefined,
    }
  }

  function renderError(field: TextField) {
    const error = getError(field)
    if (!error) return null
    return (
      <p id={`login-signup-${field}-error`} className="field-error">
        {error}
      </p>
    )
  }

  function onSubmitForm(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    setIsSubmitted(true)
    if (!result.success) return
    if ('confirmPassword' in result.data) {
      const { confirmPassword: _, ...signupInput } = result.data
      onSubmit(signupInput)
    } else {
      onSubmit(result.data)
    }
  }

  return (
    <form className="login-signup-form" noValidate onSubmit={onSubmitForm}>
      {isSignup && (
        <div className="field">
          <label htmlFor="login-signup-fullname">Full name</label>
          <input type="text" autoComplete="name" {...getTextFieldProps('fullname')} />
          {renderError('fullname')}
        </div>
      )}

      <div className="field">
        <label htmlFor="login-signup-username">Username</label>
        <input type="text" autoComplete="username" {...getTextFieldProps('username')} />
        {renderError('username')}
      </div>

      <div className="field">
        <label htmlFor="login-signup-password">Password</label>
        <input
          type="password"
          // Lets password managers offer a saved password on login and a new one on signup
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          {...getTextFieldProps('password')}
        />
        {renderError('password')}
      </div>

      {isSignup && (
        <div className="field">
          <label htmlFor="login-signup-confirmPassword">Confirm password</label>
          <input
            type="password"
            autoComplete="new-password"
            {...getTextFieldProps('confirmPassword')}
          />
          {renderError('confirmPassword')}
        </div>
      )}

      <label className="remember-me">
        <input
          type="checkbox"
          checked={form.isRemembered}
          onChange={(ev) => setForm((prev) => ({ ...prev, isRemembered: ev.target.checked }))}
        />
        Remember me
      </label>

      <button type="submit" className="main-btn" disabled={isSubmitting}>
        {isSignup ? 'Sign up' : 'Log in'}
      </button>

      <p className="switch-mode">
        {isSignup ? 'Already have an account? ' : 'New here? '}
        <Link to={otherModeTo}>{isSignup ? 'Log in' : 'Sign up'}</Link>
      </p>
    </form>
  )
}
