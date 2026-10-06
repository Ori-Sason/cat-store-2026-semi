import type React from 'react'
import { useState } from 'react'
import catImg from '../../assets/img/cat-default-color.png'
import { PickupPointList } from '../../cmps/about/pickup-point-list'
import { PickupPointMap } from '../../cmps/about/pickup-point-map'
import { PICKUP_POINTS } from '../../models/pickup-point'

export const About: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isMarkerInfoBoxOpen, setIsMarkerInfoBoxOpen] = useState(false)

  function onSelect(id: string | null) {
    if (id === null || (id === selectedId && isMarkerInfoBoxOpen)) {
      setSelectedId(null)
      setIsMarkerInfoBoxOpen(false)
      return
    }
    setSelectedId(id)
    setIsMarkerInfoBoxOpen(true)
  }

  return (
    <section className="about">
      <header className="intro-header">
        <div className="intro-text">
          <h1>About cat-store</h1>
          <p className="intro">
            cat-store connects cats with the people who'll love them. Every cat is listed by its
            owner, and you collect your new friend at one of our pickup points across Israel. Pick
            one from the list to see it on the map.
          </p>
        </div>
        <div className="intro-img">
          <img src={catImg} alt="" />
        </div>
      </header>

      <section className="panel">
        <h2>Pickup points</h2>
        <div className="locator">
          <PickupPointList
            pickupPoints={PICKUP_POINTS}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          <PickupPointMap
            pickupPoints={PICKUP_POINTS}
            selectedId={selectedId}
            isMarkerInfoBoxOpen={isMarkerInfoBoxOpen}
            onSelect={onSelect}
            onCloseMarkerInfoBox={() => setIsMarkerInfoBoxOpen(false)}
          />
        </div>
      </section>
    </section>
  )
}
