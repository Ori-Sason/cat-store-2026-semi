import type { CatInput } from '@cat-store/shared'
import { redirect, type ActionFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'
import { utilService } from '../../services/util.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// The form validates with the same catSchema, so a server 400 is a generic failure here
export async function catEditAction({
  params,
  request,
}: Pick<ActionFunctionArgs, 'params' | 'request'>) {
  const catInput = (await request.json()) as CatInput
  try {
    const savedCat = await catService.save(params.id ? { ...catInput, _id: params.id } : catInput)
    useUserMsgStore.getState().queueSuccessNavigationMsg('Cat saved')
    return redirect(`/cat/${savedCat._id}`)
  } catch (err) {
    return utilService.toActionError(err)
  }
}
