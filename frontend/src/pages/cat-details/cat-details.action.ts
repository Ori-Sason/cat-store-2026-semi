import { data, redirect, type ActionFunctionArgs } from 'react-router'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { errorService } from '../../services/error.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// Delete is the only action on details
export async function catDetailsAction({ params }: Pick<ActionFunctionArgs, 'params'>) {
  try {
    await catService.remove(params.id!)
  } catch (err) {
    useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
    // An error status skips the loader reload, so a failing server can't swap the page for RouteError
    const status = err instanceof ApiError && err.status >= 400 ? err.status : 500
    return data(null, { status })
  }
  useUserMsgStore.getState().queueSuccessNavigationMsg('Cat deleted')
  return redirect('/cat')
}
