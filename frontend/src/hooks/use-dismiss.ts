import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Closes a popup (menu, panel) on Escape or a press outside `ref`.
// Listeners exist only while it's open, so a closed popup costs nothing.
// `onDismiss` gets the event, so the caller can tell a key from a click (e.g. to restore focus)
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: (ev: KeyboardEvent | PointerEvent) => void,
) {
  const onDismissRef = useRef(onDismiss)

  useLayoutEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(ev: PointerEvent) {
      if (ref.current?.contains(ev.target as Node)) return
      onDismissRef.current(ev)
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onDismissRef.current(ev)
    }

    // pointerdown, not click: it fires before focus moves, and covers mouse, touch and pen
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, ref])
}
