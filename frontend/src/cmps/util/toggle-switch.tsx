import type React from 'react'

interface ToggleSwitchProps {
  label: string
  isChecked: boolean
  onChange: (isChecked: boolean) => void
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, isChecked, onChange }) => {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        role="switch"
        checked={isChecked}
        onChange={(ev) => onChange(ev.target.checked)}
      />
      {label}
    </label>
  )
}
