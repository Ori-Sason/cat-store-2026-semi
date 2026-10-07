import type React from 'react'
import type { LoginInput, SignupInput } from '@cat-store/shared'
import { Link, useNavigation, useSearchParams, useSubmit } from 'react-router'
import { LoginSignupForm, type LoginSignupMode } from '../../cmps/login-signup/login-signup-form'
import { utilService } from '../../services/util.service'

interface LoginSignupProps {
  mode: LoginSignupMode
}

export const LoginSignup: React.FC<LoginSignupProps> = ({ mode }) => {
  const isSignup = mode === 'signup'
  const [searchParams] = useSearchParams()
  const backTo = utilService.getSafeRedirectTo(searchParams.get('redirectTo'))
  const search = searchParams.size ? `?${searchParams}` : ''
  const submit = useSubmit()
  const navigation = useNavigation()
  // formMethod stays set through the redirect's load, so submit can't fire twice
  const isSubmitting = !!navigation.formMethod

  function onSubmit(input: LoginInput | SignupInput) {
    void submit(input, { method: 'post', encType: 'application/json' })
  }

  return (
    <main className="login-signup">
      <div className="content">
        <Link to={backTo} className="back-link">
          ← Back
        </Link>
        <section className="card">
          <h1>{isSignup ? 'Sign up' : 'Log in'}</h1>
          <LoginSignupForm
            key={mode} // A key per mode guarantees a fresh form
            mode={mode}
            isSubmitting={isSubmitting}
            otherModeTo={`${isSignup ? '/login' : '/signup'}${search}`}
            onSubmit={onSubmit}
          />
        </section>
      </div>
    </main>
  )
}
