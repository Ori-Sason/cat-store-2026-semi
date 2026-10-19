import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ChatMsg } from '@cat-store/shared'

type ChatMsgWithText = Extract<ChatMsg, { isDeleted: false }>

// The delete confirm's state and focus rules. The caller renders the confirm with msgToRemove,
// makes the log inert while isOpen (the confirm is showing), and calls cancel() when the panel
// closes, so a chat reopen starts without the confirm
export function useChatMsgRemoveConfirm(
  msgs: ChatMsg[],
  removeMsg: (msgId: string) => Promise<boolean>,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  // Only the id: the msg is looked up in msgs on every render, so the confirm sees an edit or a
  // delete that lands while it's open
  const [removeMsgId, setRemoveMsgId] = useState<string | null>(null)
  // The msg itself, quoted in the confirm. Gone or already a tombstone (someone else deleted it
  // meanwhile) closes the confirm: there's nothing left to delete
  const msgToRemove = removeMsgId
    ? msgs.find((msg): msg is ChatMsgWithText => msg._id === removeMsgId && !msg.isDeleted)
    : undefined
  const isOpen = !!msgToRemove
  // Where the focus goes back to when the confirm closes: the msg's ⋮ button
  const openerRef = useRef<HTMLElement | null>(null)

  // After the confirm closes, in an effect: until this render the log was inert, and an inert
  // element can't take the focus. A confirmed remove disables the ⋮ button until its ack, so the
  // panel takes the focus then, and it doesn't drop to <body>
  useEffect(() => {
    const opener = openerRef.current
    if (isOpen || !opener) return
    openerRef.current = null
    if (opener.isConnected && !opener.matches(':disabled')) opener.focus()
    else panelRef.current?.focus()
  }, [isOpen, panelRef])

  function open(msgId: string) {
    openerRef.current = document.activeElement as HTMLElement | null
    setRemoveMsgId(msgId)
  }

  function confirm() {
    if (removeMsgId) void removeMsg(removeMsgId)
    setRemoveMsgId(null)
  }

  function cancel() {
    setRemoveMsgId(null)
  }

  return { msgToRemove, isOpen, open, confirm, cancel }
}
