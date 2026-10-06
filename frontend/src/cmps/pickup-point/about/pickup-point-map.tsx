import type React from 'react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import 'ol/ol.css'
import { Circle, Fill, Stroke, Style } from 'ol/style'
import { useOlMap, type MarkerStyles } from '../../../hooks/use-ol-map'
import type { PickupPoint } from '../../../models/pickup-point'
import { MarkerInfoBox } from './marker-info-box'

// OL draws markers on a canvas, out of CSS's reach. The colors still come from the SCSS tokens:
// _pickup-point-map.scss exposes them as custom properties, read here once the map mounts
function _createMarkerStyles(target: HTMLElement): MarkerStyles {
  const css = getComputedStyle(target)
  const cssVar = (name: string) => css.getPropertyValue(name).trim()
  const borderClr = cssVar('--marker-border-clr')

  return {
    normal: new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: cssVar('--marker-clr') }),
        stroke: new Stroke({ color: borderClr, width: 2 }),
      }),
    }),
    selected: new Style({
      image: new Circle({
        radius: 11,
        fill: new Fill({ color: cssVar('--marker-selected-clr') }),
        stroke: new Stroke({ color: borderClr, width: 3 }),
      }),
      // Draw the selected marker above its neighbors
      zIndex: 1,
    }),
  }
}

interface PickupPointMapProps {
  pickupPoints: PickupPoint[]
  selectedId: string | null
  isMarkerInfoBoxOpen: boolean
  onSelect: (id: string | null) => void
  onCloseMarkerInfoBox: () => void
}

export const PickupPointMap: React.FC<PickupPointMapProps> = ({
  pickupPoints,
  selectedId,
  isMarkerInfoBoxOpen,
  onSelect,
  onCloseMarkerInfoBox,
}) => {
  const targetRef = useRef<HTMLDivElement>(null)
  const { infoBoxEl } = useOlMap({
    targetRef,
    pickupPoints,
    selectedId,
    isMarkerInfoBoxOpen,
    onSelect,
    createMarkerStyles: _createMarkerStyles,
  })
  const selectedPoint = pickupPoints.find((p) => p.id === selectedId)

  return (
    <>
      <div ref={targetRef} className="pickup-point-map" />
      {selectedPoint &&
        isMarkerInfoBoxOpen &&
        createPortal(
          <MarkerInfoBox point={selectedPoint} onClose={onCloseMarkerInfoBox} />,
          infoBoxEl,
        )}
    </>
  )
}
