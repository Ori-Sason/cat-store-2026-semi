import type React from 'react'
import type { CatLabel } from '@cat-store/shared'
import { LABEL_COLORS } from '../../models/label'

interface LabelChipProps {
  label: CatLabel
}

export const LabelChip: React.FC<LabelChipProps> = ({ label }) => {
  const { bg, fg } = LABEL_COLORS[label]
  return (
    <span
      className="label-chip"
      style={{ '--label-bg': bg, '--label-fg': fg } as React.CSSProperties}
    >
      {label}
    </span>
  )
}
