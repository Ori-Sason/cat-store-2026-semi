import type React from 'react'
import { PRICE_TEASER_LABEL_COUNT } from './label-price-teaser.util'

// Same row grid as the real bars, so nothing jumps when they arrive
export const LabelPriceTeaserSkeleton: React.FC = () => {
  return (
    <div className="label-price-teaser-skeleton" aria-busy="true" aria-label="Loading prices">
      {Array.from({ length: PRICE_TEASER_LABEL_COUNT }, (_, idx) => (
        <div key={idx} className="bar-row">
          <span className="skel name" />
          {/* Shorter down the list, like bars sorted by median */}
          <span className="skel track" style={{ width: `${90 - idx * 14}%` }} />
          <span className="skel val" />
        </div>
      ))}
    </div>
  )
}
