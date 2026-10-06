import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import View from 'ol/View'
import { fromLonLat } from 'ol/proj'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PICKUP_POINTS } from '../../models/pickup-point'
import { About } from './about'

// Real OpenLayers runs here (canvas is mocked in test-setup). jsdom has no layout, so marker
// clicks (forEachFeatureAtPixel) can't be driven - these tests go through the list instead.
// OL also keeps the overlay container display:none until it renders a frame, which needs a map
// size, so info-box queries pass `hidden: true`
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

    await user.click(screen.getByRole('button', { name: /^Haifa/ }))

    expect(
      screen.getByRole('article', { name: 'Haifa pickup point', hidden: true }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(animateSpy).not.toHaveBeenCalled()
  })
})
