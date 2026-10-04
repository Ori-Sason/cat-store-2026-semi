import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
) {
  const fnRef = useRef(fn)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isPending, setIsPending] = useState(false)

  useLayoutEffect(() => {
    fnRef.current = fn
  })

  // Unmount cancels a pending call instead of flushing it - a late call would act on a page that's gone
  useEffect(() => () => clearTimeout(timeoutIdRef.current), [])

  const call = useCallback(
    (...args: Args) => {
      clearTimeout(timeoutIdRef.current)
      setIsPending(true)
      timeoutIdRef.current = setTimeout(() => {
        setIsPending(false)
        fnRef.current(...args)
      }, delayMs)
    },
    [delayMs],
  )

  const cancel = useCallback(() => {
    clearTimeout(timeoutIdRef.current)
    setIsPending(false)
  }, [])

  return { call, cancel, isPending }
}
