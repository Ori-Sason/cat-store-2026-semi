import type { LoggedInUser } from '@cat-store/shared'
import { create } from 'zustand'

interface LoggedInUserState {
  loggedInUser: LoggedInUser | null
  setLoggedInUser: (loggedInUser: LoggedInUser) => void
  clearLoggedInUser: () => void
}

// Hydrated once in main.tsx from /api/auth/me, before the first render
export const useLoggedInUserStore = create<LoggedInUserState>((set) => ({
  loggedInUser: null,
  setLoggedInUser: (loggedInUser) => set({ loggedInUser }),
  clearLoggedInUser: () => set({ loggedInUser: null }),
}))
