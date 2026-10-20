import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ChatPresence, LoggedInUser } from '@cat-store/shared'

// The "here now" list's state and focus rules. The caller renders the list in the panel body's
// place while isShown (the body stays mounted under it, hidden and inert), puts countRef on the
// header's count button, and calls reset() when the panel closes, so a reopen starts on the log
export function useChatPresenceList(
  presence: ChatPresence | null,
  loggedInUser: LoggedInUser | null,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  // The panel body shows the log (with the typing line and the composer) or the list
  const [view, setView] = useState<'log' | 'presence'>('log')
  const countRef = useRef<HTMLButtonElement>(null)

  // Names reach only a logged-in socket, and only a logged-in viewer is shown them
  const users = loggedInUser ? (presence?.users ?? null) : null
  // The count is a button, and the list can show, only with someone else there
  const isAvailable = !!users?.some((user) => user._id !== loggedInUser?._id)

  if (view === 'presence' && !isAvailable) setView('log')
  const isShown = view === 'presence' && isAvailable

  // The list closed by itself and took the focused back button with it. "Back to chat" moves the
  // focus itself, so this only catches the focus that dropped to <body>
  useEffect(() => {
    if (isShown || document.activeElement !== document.body) return
    panelRef.current?.focus()
  }, [isShown, panelRef])

  // The header's count only opens the list. The way back is "Back to chat", so a second click on
  // the count does nothing
  function showList() {
    setView('presence')
  }

  // The header's count is still there (the list shows only while it's a button), so it takes the focus
  function hideList() {
    setView('log')
    countRef.current?.focus()
  }

  function reset() {
    setView('log')
  }

  return {
    users,
    isAvailable,
    isShown,
    isJustYou: !!users && !isAvailable,
    countRef,
    showList,
    hideList,
    reset,
  }
}
