import type React from 'react'
import type { PickupPoint } from '../../models/pickup-point'

interface MarkerInfoBoxProps {
  point: PickupPoint
  onClose: () => void
}

export const MarkerInfoBox: React.FC<MarkerInfoBoxProps> = ({ point, onClose }) => {
  return (
    <article className="marker-info-box" aria-label={`${point.name} pickup point`}>
      <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h3>{point.name}</h3>
      <p className="address">{point.address}</p>
      <p className="hours">{point.hours}</p>
    </article>
  )
}
