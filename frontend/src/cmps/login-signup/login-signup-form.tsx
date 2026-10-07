import type React from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { loginSchema, type LoginInput, type SignupInput } from '@cat-store/shared'
import { signupFormSchema } from '../../models/user'
import { useFormValidation } from '../../hooks/use-form-validation'
import { FieldError } from '../common/util/field-error'

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
  const isSignup = mode === 'signup'

  const formValidation = useFormValidation<typeof loginSchema | typeof signupFormSchema>(
    isSignup ? signupFormSchema : loginSchema,
    form,
    'login-signup',
  )
  const { formParseResult } = formValidation

  function getTextFieldProps(field: TextField) {
    return {
      value: form[field],
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: ev.target.value })),
      ...formValidation.getFieldProps(field),
    }
  }

  function renderError(field: TextField) {
    return (
      <FieldError
        errorId={formValidation.getErrorId(field)}
        errorTxt={formValidation.getError(field)}
      />
    )
  }

  function onSubmitForm(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    formValidation.markSubmitted()
    if (formParseResult.success) onSubmit(formParseResult.data)
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
