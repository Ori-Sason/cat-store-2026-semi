import { create } from 'zustand'
import type { UserMsg } from '../models/util'

interface UserMsgState {
  msg: UserMsg | null
  showSuccessMsg: (txt: string) => void
  showErrorMsg: (txt: string) => void
  clearMsg: () => void

  navigationMsg: UserMsg | null
  queueSuccessNavigationMsg: (txt: string) => void
  flushNavigationMsg: () => void
}

export const useUserMsgStore = create<UserMsgState>((set) => {
  let msgId = 0

  return {
    msg: null,
    showSuccessMsg: (txt) => set({ msg: { id: msgId++, txt, type: 'success' } }),
    showErrorMsg: (txt) => set({ msg: { id: msgId++, txt, type: 'error' } }),
    clearMsg: () => set({ msg: null }),

    navigationMsg: null,
    queueSuccessNavigationMsg: (txt) =>
      set({ navigationMsg: { id: msgId++, txt, type: 'success' } }),
    flushNavigationMsg: () =>
      set((state) =>
        state.navigationMsg ? { msg: state.navigationMsg, navigationMsg: null } : state,
      ),
  }
})
