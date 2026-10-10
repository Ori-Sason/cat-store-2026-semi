import type React from 'react'
import type { CatLabel } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'

interface LabelChipProps {
  label: CatLabel
  className?: string
}

export const LabelChip: React.FC<LabelChipProps> = ({ label, className = '' }) => {
  return (
    <span className={`label-chip ${className}`} style={utilService.getLabelStyle(label)}>
      {label}
    </span>
  )
}
