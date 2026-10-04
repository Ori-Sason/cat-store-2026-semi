const _priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  trailingZeroDisplay: 'stripIfInteger', // $120, not $120.00 - but $95.50, not $95.5
})

function formatPrice(price: number): string {
  return _priceFormatter.format(price)
}

export const utilService = {
  formatPrice,
}
