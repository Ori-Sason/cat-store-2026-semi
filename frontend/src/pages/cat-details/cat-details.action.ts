import { redirect, type ActionFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'
import { errorService } from '../../services/error.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// Delete is the only action on details
export async function catDetailsAction({ params }: Pick<ActionFunctionArgs, 'params'>) {
  try {
    await catService.remove(params.id!)
  } catch (err) {
    useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
    return null
  }
  useUserMsgStore.getState().queueSuccessNavigationMsg('Cat deleted')
  return redirect('/cat')
}
