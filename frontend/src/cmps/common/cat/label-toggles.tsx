import type React from 'react'
import { CAT_LABELS, type CatLabel } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'

interface LabelTogglesProps {
  labels: CatLabel[]
  onChange: (labels: CatLabel[]) => void
  'aria-label'?: string
  'aria-labelledby'?: string
}

export const LabelToggles: React.FC<LabelTogglesProps> = ({ labels, onChange, ...ariaProps }) => {
  // Rebuilt from CAT_LABELS, so the order never depends on click order
  function onToggle(label: CatLabel) {
    const isOn = labels.includes(label)
    onChange(CAT_LABELS.filter((l) => (l === label ? !isOn : labels.includes(l))))
  }

  return (
    <div className="label-toggles" role="group" {...ariaProps}>
      {CAT_LABELS.map((label) => (
        <button
          key={label}
          type="button"
          className="label-toggle"
          style={utilService.getLabelStyle(label)}
          aria-pressed={labels.includes(label)}
          onClick={() => onToggle(label)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
