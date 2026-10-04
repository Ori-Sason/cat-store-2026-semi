import { useLayoutEffect, useRef, useState } from 'react'
import { utilService } from '../services/util.service'

// Fits a row of items to one line. The row must always render every item, then the "+N" element
// last; items past fitCount stay in the DOM, hidden out of flow, so they can be measured.
// Observing every child catches anything that changes a width - a resize, or the web font swapping in.
export function useFitCount(itemCount: number) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [fitCount, setFitCount] = useState(itemCount)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return

    const fit = () => {
      const children = [...row.children]
      const itemWidths = children.slice(0, itemCount).map(_getWidth)
      const moreEl = children[itemCount]
      const moreWidth = moreEl ? _getWidth(moreEl) : 0
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0
      setFitCount(utilService.getFitCount(itemWidths, _getWidth(row), gap, moreWidth))
    }
    fit()

    const observer = new ResizeObserver(fit)
    observer.observe(row)
    for (const child of row.children) observer.observe(child)
    return () => observer.disconnect()
  }, [itemCount])

  return { rowRef, fitCount }
}

// Fractional, unlike offsetWidth - whole-pixel rounding adds up across a row of chips
function _getWidth(el: Element) {
  return el.getBoundingClientRect().width
}
