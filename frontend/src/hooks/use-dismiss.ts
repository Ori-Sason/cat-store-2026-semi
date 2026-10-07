import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

// Closes a popup (menu, panel) on Escape, a press outside `ref`, or focus leaving `ref`.
// Listeners exist only while it's open, so a closed popup costs nothing.
// `onDismiss` gets the event, so the caller can tell a key from a click (e.g. to restore focus)
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: (ev: KeyboardEvent | PointerEvent | FocusEvent) => void,
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

    // Tabbing out of the popup. A null relatedTarget (focus went nowhere, e.g. a click on plain
    // text or a switch to another window) is left to pointerdown, so leaving the tab doesn't close it
    function onFocusOut(ev: FocusEvent) {
      const nextFocus = ev.relatedTarget as Node | null
      if (!nextFocus || ref.current?.contains(nextFocus)) return
      onDismissRef.current(ev)
    }

    const root = ref.current
    // pointerdown, not click: it fires before focus moves, and covers mouse, touch and pen
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    root?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      root?.removeEventListener('focusout', onFocusOut)
    }
  }, [isOpen, ref])
}
