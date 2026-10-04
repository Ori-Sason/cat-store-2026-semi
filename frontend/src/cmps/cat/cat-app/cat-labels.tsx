import type React from 'react'
import type { CatLabel } from '@cat-store/shared'
import { useFitCount } from '../../../hooks/use-fit-count'
import { LabelChip } from '../label-chip'

interface CatLabelsProps {
  labels: CatLabel[]
}

export const CatLabels: React.FC<CatLabelsProps> = ({ labels }) => {
  const { rowRef, fitCount } = useFitCount(labels.length)
  const hiddenCount = labels.length - fitCount

  return (
    <div className="cat-labels" ref={rowRef}>
      {labels.map((label, idx) => (
        <LabelChip key={label} label={label} className={idx < fitCount ? '' : 'is-hidden'} />
      ))}
      <span className={`more ${hiddenCount ? '' : 'is-hidden'}`}>
        +{hiddenCount || labels.length}
      </span>
    </div>
  )
}
