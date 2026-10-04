import { redirect, type ActionFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'
import { utilService } from '../../services/util.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// Delete is the only action on details
export async function catDetailsAction({ params }: Pick<ActionFunctionArgs, 'params'>) {
  try {
    await catService.remove(params.id!)
  } catch (err) {
    return utilService.toActionError(err)
  }
  useUserMsgStore.getState().queueSuccessNavigationMsg('Cat deleted')
  return redirect('/cat')
}
