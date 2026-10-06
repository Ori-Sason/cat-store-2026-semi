import type React from 'react'
import { useId, useRef } from 'react'
import type { CatLabel } from '@cat-store/shared'
import { useFitCount } from '../../hooks/use-fit-count'
import { LabelChip } from '../common/cat/label-chip'

interface CatLabelsProps {
  labels: CatLabel[]
}

export const CatLabels: React.FC<CatLabelsProps> = ({ labels }) => {
  const { rowRef, fitCount } = useFitCount(labels.length)
  const popoverRef = useRef<HTMLDivElement>(null)
  const anchorName = `--more${useId()}`
  const hiddenLabels = labels.slice(fitCount)
  const hiddenCount = hiddenLabels.length

  // Mouse only (Desktop) - a tap fires emulated enter events that would flash the tooltip before navigating
  function onPointerEnter(ev: React.PointerEvent) {
    if (ev.pointerType === 'mouse') popoverRef.current?.showPopover()
  }

  function onPointerLeave(ev: React.PointerEvent) {
    if (ev.pointerType === 'mouse') popoverRef.current?.hidePopover()
  }

  return (
    <div className="cat-labels" ref={rowRef}>
      {labels.map((label, idx) => (
        <LabelChip key={label} label={label} className={idx < fitCount ? '' : 'is-hidden'} />
      ))}
      <span
        className={`more ${hiddenCount ? '' : 'is-hidden'}`}
        style={{ anchorName }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <span aria-hidden="true">+{hiddenCount || labels.length}</span>
        {hiddenCount > 0 && (
          <>
            <span className="visually-hidden">
              {hiddenCount} more labels: {hiddenLabels.join(', ')}
            </span>
            {/* Top layer, so the card's overflow: hidden can't clip it */}
            <div
              className="more-popover"
              popover="manual"
              ref={popoverRef}
              aria-hidden="true"
              style={{ positionAnchor: anchorName }}
            >
              {hiddenLabels.map((label) => (
                <LabelChip key={label} label={label} />
              ))}
            </div>
          </>
        )}
      </span>
    </div>
  )
}
