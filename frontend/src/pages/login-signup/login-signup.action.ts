import type { LoginInput, SignupInput } from '@cat-store/shared'
import { redirect, type ActionFunctionArgs } from 'react-router'
import type { LoginSignupMode } from '../../cmps/login-signup/login-signup-form'
import { authService } from '../../services/auth.service'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'

// The form validates with the same schemas, so a server 400 is a generic failure here
export async function loginSignupAction(
  { request }: Pick<ActionFunctionArgs, 'request'>,
  mode: LoginSignupMode,
) {
  try {
    const loggedInUser =
      mode === 'signup'
        ? await authService.signup((await request.json()) as SignupInput)
        : await authService.login((await request.json()) as LoginInput)
    useLoggedInUserStore.getState().setLoggedInUser(loggedInUser)
    useUserMsgStore.getState().queueSuccessNavigationMsg(`Welcome, ${loggedInUser.fullname}`)
    const redirectTo = new URL(request.url).searchParams.get('redirectTo')
    return redirect(utilService.getSafeRedirectTo(redirectTo))
  } catch (err) {
    return utilService.toActionError(err)
  }
}
