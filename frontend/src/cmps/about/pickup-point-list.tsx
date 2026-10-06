import type React from 'react'
import type { PickupPoint } from '../../models/pickup-point'

interface PickupPointListProps {
  pickupPoints: PickupPoint[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export const PickupPointList: React.FC<PickupPointListProps> = ({
  pickupPoints,
  selectedId,
  onSelect,
}) => {
  return (
    <ul className="pickup-point-list clean-list">
      {pickupPoints.map((point) => {
        const isSelected = point.id === selectedId
        return (
          <li key={point.id}>
            <button
              type="button"
              className={isSelected ? 'selected' : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelect(point.id)}
            >
              <span className="name">{point.name}</span>
              <span className="address">{point.address}</span>
              <span className="hours">{point.hours}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
