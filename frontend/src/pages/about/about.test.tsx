import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OlMap from 'ol/Map'
import Overlay from 'ol/Overlay'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PICKUP_POINTS } from '../../models/pickup-point'
import { About } from './about'

// Real OpenLayers runs here (canvas is mocked in test-setup). jsdom has no layout, so a real
// click can't hit a marker: map-click tests capture OL's click handler and stub which marker is
// under the pixel (_mapClicker). OL also keeps the overlay container display:none until it
// renders a frame, which needs a map size, so info-box queries pass `hidden: true`

type _MapClickHandler = (ev: { pixel: number[] }) => void

// Call before render. Returns a click on the map that "hits" the given marker id, or an empty
// spot for undefined
function _mapClicker() {
  // OL copies onInternal to each instance as `on` in its constructor, so `on` isn't spyable on
  // the prototype - this spy is picked up by every map created after it
  const onSpy = vi.spyOn(OlMap.prototype, 'onInternal')
  const hitSpy = vi.spyOn(OlMap.prototype, 'forEachFeatureAtPixel')
  return (markerId: string | undefined) => {
    const calls = onSpy.mock.calls as unknown as [string, _MapClickHandler][]
    const handler = calls.findLast(([type]) => type === 'click')?.[1]
    if (!handler) throw new Error('the map registered no click handler')
    hitSpy.mockReturnValue(markerId)
    // OL calls it outside React's event system, so wrap the state updates
    act(() => handler({ pixel: [0, 0] }))
  }
}

function _centerOf(id: string) {
  const point = PICKUP_POINTS.find((p) => p.id === id)!
  return fromLonLat([point.lng, point.lat])
}

describe('About', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pans the map to a pickup point picked from the list and opens its info box', async () => {
    const animateSpy = vi.spyOn(View.prototype, 'animate')
    const user = userEvent.setup()
    const eilat = PICKUP_POINTS.find((p) => p.id === 'eilat')!
    render(<About />)

    await user.click(screen.getByRole('button', { name: /^Eilat/ }))

    expect(screen.getByRole('button', { name: /^Eilat/ })).toHaveAttribute('aria-pressed', 'true')
    const infoBox = screen.getByRole('article', { name: 'Eilat pickup point', hidden: true })
    expect(infoBox).toHaveTextContent(eilat.address)
    expect(infoBox).toHaveTextContent(eilat.hours)
    // lng first: a swapped pair would still "work" but point somewhere else entirely
    expect(animateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ center: fromLonLat([eilat.lng, eilat.lat]) }),
    )
  })

  it('moves the info box when another pickup point is picked', async () => {
    const user = userEvent.setup()
    render(<About />)

    await user.click(screen.getByRole('button', { name: /^Eilat/ }))
    await user.click(screen.getByRole('button', { name: /^Haifa/ }))

    expect(
      screen.getByRole('article', { name: 'Haifa pickup point', hidden: true }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('article', { name: 'Eilat pickup point', hidden: true }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Eilat/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('deselects a pickup point picked again and zooms back out to the whole map', async () => {
    const animateSpy = vi.spyOn(View.prototype, 'animate')
    const user = userEvent.setup()
    render(<About />)
    // The view already starts zoomed out, so mounting must not animate
    expect(animateSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^Jerusalem/ }))
    await user.click(screen.getByRole('button', { name: /^Jerusalem/ }))

    expect(screen.getByRole('button', { name: /^Jerusalem/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.queryByRole('article', { hidden: true })).not.toBeInTheDocument()
    expect(animateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ center: fromLonLat([34.95, 31.4]), zoom: 7 }),
    )
  })

  it("closes only the info box from its close button, keeping the selection and the map's view", async () => {
    const user = userEvent.setup()
    render(<About />)
    await user.click(screen.getByRole('button', { name: /^Haifa/ }))
    const animateSpy = vi.spyOn(View.prototype, 'animate')

    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))

    expect(screen.queryByRole('article', { hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(animateSpy).not.toHaveBeenCalled()
  })

  it('opens the info box when another pickup point is picked after closing it', async () => {
    const user = userEvent.setup()
    render(<About />)

    await user.click(screen.getByRole('button', { name: /^Haifa/ }))
    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))
    await user.click(screen.getByRole('button', { name: /^Eilat/ }))

    expect(
      screen.getByRole('article', { name: 'Eilat pickup point', hidden: true }),
    ).toBeInTheDocument()
  })

  it('reopens a closed info box when its pickup point is picked again, without deselecting', async () => {
    const user = userEvent.setup()
    render(<About />)
    await user.click(screen.getByRole('button', { name: /^Haifa/ }))
    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))
    const animateSpy = vi.spyOn(View.prototype, 'animate')
    const setPositionSpy = vi.spyOn(Overlay.prototype, 'setPosition')

    await user.click(screen.getByRole('button', { name: /^Haifa/ }))

    expect(
      screen.getByRole('article', { name: 'Haifa pickup point', hidden: true }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(animateSpy).not.toHaveBeenCalled()
    // Setting the position again is what runs OL's autoPan, bringing an off-screen box into view
    expect(setPositionSpy).toHaveBeenCalledWith(_centerOf('haifa'))
  })

  it('pins the info box to the selected marker, and unpins it on close and deselect', async () => {
    const setPositionSpy = vi.spyOn(Overlay.prototype, 'setPosition')
    const user = userEvent.setup()
    render(<About />)

    await user.click(screen.getByRole('button', { name: /^Haifa/ }))
    expect(setPositionSpy).toHaveBeenLastCalledWith(_centerOf('haifa'))

    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))
    expect(setPositionSpy).toHaveBeenLastCalledWith(undefined)

    await user.click(screen.getByRole('button', { name: /^Eilat/ }))
    expect(setPositionSpy).toHaveBeenLastCalledWith(_centerOf('eilat'))

    await user.click(screen.getByRole('button', { name: /^Eilat/ }))
    expect(setPositionSpy).toHaveBeenLastCalledWith(undefined)
  })

  describe('map clicks', () => {
    it('selects a pickup point from its marker, then deselects it on a second click', () => {
      const clickMap = _mapClicker()
      render(<About />)

      clickMap('haifa')
      expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('article', { name: 'Haifa pickup point', hidden: true }),
      ).toBeInTheDocument()

      clickMap('haifa')
      expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(screen.queryByRole('article', { hidden: true })).not.toBeInTheDocument()
    })

    it('reopens a closed info box from its marker without deselecting', async () => {
      const clickMap = _mapClicker()
      const user = userEvent.setup()
      render(<About />)

      clickMap('haifa')
      await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))
      clickMap('haifa')

      expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('article', { name: 'Haifa pickup point', hidden: true }),
      ).toBeInTheDocument()
    })

    it('deselects and zooms back out on a click on an empty spot', async () => {
      const clickMap = _mapClicker()
      const animateSpy = vi.spyOn(View.prototype, 'animate')
      const user = userEvent.setup()
      render(<About />)
      await user.click(screen.getByRole('button', { name: /^Haifa/ }))

      clickMap(undefined)

      expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(screen.queryByRole('article', { hidden: true })).not.toBeInTheDocument()
      expect(animateSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ center: fromLonLat([34.95, 31.4]), zoom: 7 }),
      )
    })
  })

  describe('map lifecycle', () => {
    it("leaves exactly one map after StrictMode's mount → unmount → mount", () => {
      const { container } = render(
        <StrictMode>
          <About />
        </StrictMode>,
      )

      expect(container.querySelectorAll('.ol-viewport')).toHaveLength(1)
    })

    it('removes the map on unmount', () => {
      const { container, unmount } = render(<About />)
      const target = container.querySelector('.pickup-point-map')!

      unmount()

      expect(target.querySelector('.ol-viewport')).toBeNull()
    })
  })
})
