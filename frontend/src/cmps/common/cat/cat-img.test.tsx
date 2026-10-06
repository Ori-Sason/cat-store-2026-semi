import { fireEvent, render, screen } from '@testing-library/react'
import type { Cat } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import defaultImg from '../../../assets/img/cat-default-bw.png'
import { CatImg } from './cat-img'

const _URL = 'https://robohash.org/mitzi?set=set4'

function _cat(overrides: Partial<Cat> = {}) {
  return { name: 'Mitzi', imgUrl: _URL, isInStock: true, ...overrides }
}

const _photo = () => screen.getByRole('img', { name: 'Mitzi' })

describe('CatImg', () => {
  it('shows the cat image URL', () => {
    render(<CatImg cat={_cat()} />)

    expect(_photo()).toHaveAttribute('src', _URL)
  })

  it('shows the default image for an empty imgUrl', () => {
    render(<CatImg cat={_cat({ imgUrl: '' })} />)

    expect(_photo()).toHaveAttribute('src', defaultImg)
  })

  it('falls back to the default image when the URL fails to load', () => {
    render(<CatImg cat={_cat()} />)
    fireEvent.error(_photo())

    expect(_photo()).toHaveAttribute('src', defaultImg)
  })

  it('tries a new URL after an earlier one failed', () => {
    const { rerender } = render(<CatImg cat={_cat()} />)
    fireEvent.error(_photo())
    rerender(<CatImg cat={_cat({ imgUrl: 'https://robohash.org/tom?set=set4' })} />)

    expect(_photo()).toHaveAttribute('src', 'https://robohash.org/tom?set=set4')
  })

  it('shows the sold-out badge for a cat out of stock', () => {
    render(<CatImg cat={_cat({ isInStock: false })} />)

    expect(screen.getByRole('img', { name: 'Sold out' })).toBeInTheDocument()
  })

  it('hides the sold-out badge when isSoldOutShown is off', () => {
    render(<CatImg cat={_cat({ isInStock: false })} isSoldOutShown={false} />)

    expect(screen.queryByRole('img', { name: 'Sold out' })).not.toBeInTheDocument()
  })
})
