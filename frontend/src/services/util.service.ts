const _priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  trailingZeroDisplay: 'stripIfInteger', // $120, not $120.00 - but $95.50, not $95.5
})

function formatPrice(price: number): string {
  return _priceFormatter.format(price)
}

// How many items fit in one row, keeping room for a trailing "+N" chip while any are left out
function getFitCount(itemWidths: number[], rowWidth: number, gap: number, moreWidth: number) {
  let usedWidth = 0
  for (let i = 0; i < itemWidths.length; i++) {
    usedWidth += (i ? gap : 0) + itemWidths[i]
    const isLast = i === itemWidths.length - 1
    const reservedWidth = isLast ? 0 : gap + moreWidth
    if (usedWidth + reservedWidth > rowWidth) return i
  }
  return itemWidths.length
}

export const utilService = {
  formatPrice,
  getFitCount,
}
