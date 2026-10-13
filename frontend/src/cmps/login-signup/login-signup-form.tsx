import type React from 'react'
import { Link } from 'react-router'
import { loginSchema, type LoginInput, type SignupInput } from '@cat-store/shared'
import { signupFormSchema } from '../../models/user'
import { useForm } from '../../hooks/use-form'
import { FieldError } from '../common/util/field-error'

export type LoginSignupMode = 'login' | 'signup'

interface LoginSignupForm {
  fullname: string
  username: string
  password: string
  confirmPassword: string
  isRemembered: boolean
}

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
  const isSignup = mode === 'signup'
  const {
    form,
    setField,
    getTextFieldProps,
    getErrorProps,
    onSubmit: onSubmitForm,
  } = useForm({
    initialForm: _EMPTY_FORM,
    schema: isSignup ? signupFormSchema : loginSchema,
    idPrefix: 'login-signup',
    onValidSubmit: onSubmit,
  })

  return (
    <form className="login-signup-form" noValidate onSubmit={onSubmitForm}>
      {isSignup && (
        <div className="field">
          <label htmlFor="login-signup-fullname">Full name</label>
          <input type="text" autoComplete="name" {...getTextFieldProps('fullname')} />
          <FieldError {...getErrorProps('fullname')} />
        </div>
      )}

      <div className="field">
        <label htmlFor="login-signup-username">Username</label>
        <input type="text" autoComplete="username" {...getTextFieldProps('username')} />
        <FieldError {...getErrorProps('username')} />
      </div>

      <div className="field">
        <label htmlFor="login-signup-password">Password</label>
        <input
          type="password"
          // Lets password managers offer a saved password on login and a new one on signup
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          {...getTextFieldProps('password')}
        />
        <FieldError {...getErrorProps('password')} />
      </div>

      {isSignup && (
        <div className="field">
          <label htmlFor="login-signup-confirmPassword">Confirm password</label>
          <input
            type="password"
            autoComplete="new-password"
            {...getTextFieldProps('confirmPassword')}
          />
          <FieldError {...getErrorProps('confirmPassword')} />
        </div>
      )}

      <label className="remember-me">
        <input
          type="checkbox"
          checked={form.isRemembered}
          onChange={(ev) => setField('isRemembered', ev.target.checked)}
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
