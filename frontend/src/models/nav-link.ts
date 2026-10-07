export interface NavLinkItem {
  to: string
  label: string
}

export const NAV_LINKS: NavLinkItem[] = [
  { to: '/cat', label: 'Cats' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/about', label: 'About' },
]
