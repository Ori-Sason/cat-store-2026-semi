import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
// Per-module imports, never the `ol` barrel, so tree-shaking keeps only what's used
import Feature from 'ol/Feature'
import OlMap from 'ol/Map'
import Overlay from 'ol/Overlay'
import View from 'ol/View'
import Point from 'ol/geom/Point'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import type { Style } from 'ol/style'
import type { PickupPoint } from '../models/pickup-point'

export interface MarkerStyles {
  normal: Style
  selected: Style
}

interface UseOlMapOptions {
  targetRef: RefObject<HTMLDivElement | null>
  pickupPoints: PickupPoint[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  createMarkerStyles: (target: HTMLElement) => MarkerStyles
}

const _INITIAL_CENTER_LNG_LAT = [34.95, 31.4]
const _INITIAL_ZOOM = 7
const _SELECTED_ZOOM = 17
const _PAN_DURATION_MS = 500

// React glue for an OpenLayers map with one marker per pickup point and an info-box overlay.
// OL is imperative: the map lives in refs, React only drives it through effects
export function useOlMap({
  targetRef,
  pickupPoints,
  selectedId,
  onSelect,
  createMarkerStyles,
}: UseOlMapOptions) {
  const mapRef = useRef<OlMap | null>(null)
  const overlayRef = useRef<Overlay | null>(null)
  const sourceRef = useRef<VectorSource | null>(null)
  const markerStylesRef = useRef<MarkerStyles | null>(null)
  const hadSelectionRef = useRef(false)

  // OL moves the overlay element into its own container, so React must not own it.
  // Callers portal the info-box content into it instead
  const [infoBoxEl] = useState(() => document.createElement('div'))

  // Effect Events: the map's setup and listeners always call the latest callbacks, and a new
  // function identity from the caller doesn't rebuild the map (they're not effect deps)
  const onMapSelect = useEffectEvent(onSelect)
  // Styles are built after mount, not during render: they read the target's computed CSS
  const buildMarkerStyles = useEffectEvent(createMarkerStyles)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const markerStyles = buildMarkerStyles(target)
    const source = new VectorSource({
      features: pickupPoints.map((point) => {
        const feature = new Feature(new Point(fromLonLat([point.lng, point.lat])))
        feature.setId(point.id)
        feature.setStyle(markerStyles.normal)
        return feature
      }),
    })

    const overlay = new Overlay({
      element: infoBoxEl,
      positioning: 'bottom-center',
      offset: [0, -16],
      // Pans the map so an info box near the edge isn't cut off
      autoPan: { animation: { duration: 250 } },
    })

    const map = new OlMap({
      target,
      // OSM's default attribution control stays: the tile policy requires it
      layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source })],
      overlays: [overlay],
      view: new View({ center: fromLonLat(_INITIAL_CENTER_LNG_LAT), zoom: _INITIAL_ZOOM }),
    })

    map.on('click', (ev) => {
      const id = map.forEachFeatureAtPixel(ev.pixel, (feature) => feature.getId())
      // An empty spot clears the selection, which also closes the info box
      onMapSelect(typeof id === 'string' ? id : null)
    })

    map.on('pointermove', (ev) => {
      if (ev.dragging) return
      target.style.cursor = map.hasFeatureAtPixel(ev.pixel) ? 'pointer' : ''
    })

    mapRef.current = map
    overlayRef.current = overlay
    sourceRef.current = source
    markerStylesRef.current = markerStyles

    return () => {
      // Detach so StrictMode's mount → unmount → mount doesn't leave two maps in the target
      map.setTarget(undefined)
      mapRef.current = null
      overlayRef.current = null
      sourceRef.current = null
      markerStylesRef.current = null
    }
  }, [targetRef, pickupPoints, infoBoxEl])

  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    const source = sourceRef.current
    const markerStyles = markerStylesRef.current
    if (!map || !overlay || !source || !markerStyles) return

    for (const feature of source.getFeatures()) {
      feature.setStyle(feature.getId() === selectedId ? markerStyles.selected : markerStyles.normal)
    }

    const point = pickupPoints.find((p) => p.id === selectedId)
    if (!point) {
      overlay.setPosition(undefined)
      // Deselect → back to the whole country. Skipped on mount: the view already starts there
      if (hadSelectionRef.current) {
        map.getView().animate({
          center: fromLonLat(_INITIAL_CENTER_LNG_LAT),
          zoom: _INITIAL_ZOOM,
          duration: _PAN_DURATION_MS,
        })
      }
      hadSelectionRef.current = false
      return
    }

    const center = fromLonLat([point.lng, point.lat])
    map.getView().animate({ center, zoom: _SELECTED_ZOOM, duration: _PAN_DURATION_MS })
    overlay.setPosition(center)
    hadSelectionRef.current = true
  }, [selectedId, pickupPoints])

  return { infoBoxEl }
}
