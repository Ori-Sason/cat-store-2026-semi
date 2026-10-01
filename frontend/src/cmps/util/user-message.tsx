import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useUserMsgStore } from '../../store/user-msg.store'
import { useNavigation } from 'react-router'

const CLOSE_ANIM_MS = 700
const DISPLAY_ANIM_MS = 5000

export const UserMessage: React.FC = () => {
  const navigatorState = useNavigation().state
  const userMsg = useUserMsgStore((state) => state.msg)
  const [closedMsgId, setClosedMsgId] = useState<number | null>(null)
  const isOpen = !!userMsg && userMsg.id !== closedMsgId

  const compnentTimeoutId = useRef(0)
  const openTimeoutId = useRef(0)

  useEffect(() => {
    if (!userMsg) return

    openTimeoutId.current = setTimeout(() => {
      setClosedMsgId(userMsg.id)
    }, DISPLAY_ANIM_MS)

    compnentTimeoutId.current = setTimeout(() => {
      useUserMsgStore.getState().clearMsg()
    }, DISPLAY_ANIM_MS + CLOSE_ANIM_MS)

    return () => {
      clearTimeout(compnentTimeoutId.current)
      clearTimeout(openTimeoutId.current)
    }
  }, [userMsg])

  const onCloseMsg = (ev: React.MouseEvent<HTMLDivElement>) => {
    ev.stopPropagation()
    clearTimeout(openTimeoutId.current)
    setClosedMsgId(userMsg!.id)
    clearTimeout(compnentTimeoutId.current)
    compnentTimeoutId.current = setTimeout(
      () => useUserMsgStore.getState().clearMsg(),
      CLOSE_ANIM_MS,
    )
  }

  useEffect(() => {
    if (navigatorState === 'idle') {
      useUserMsgStore.getState().flushNavigationMsg()
    }
  }, [navigatorState])

  return (
    <section
      className={`user-message ${isOpen ? 'open' : ''}`}
      style={
        {
          '--close-anim-duration': `${CLOSE_ANIM_MS}ms`,
          '--display-anim-duration': `${DISPLAY_ANIM_MS}ms`,
        } as React.CSSProperties
      }
    >
      <div className="content-container">
        <div className="close-btn" onClick={onCloseMsg}>
          X
        </div>
        <pre className="content">{userMsg?.txt}</pre>
      </div>
      <div className="timer">
        <div className={`thumb ${userMsg?.type ?? ''}`} key={userMsg?.id}></div>
      </div>
    </section>
  )
}
