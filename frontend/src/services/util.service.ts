import type { CSSProperties } from 'react'
import { data, type Location, type ShouldRevalidateFunction } from 'react-router'
import type { CatLabel } from '@cat-store/shared'
import { ApiError } from '../models/api-error'
import { LABEL_COLORS } from '../models/label'
import type { BackToLocationState } from '../models/util'
import { useUserMsgStore } from '../store/user-msg.store'
import { errorService } from './error.service'

const _priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  trailingZeroDisplay: 'stripIfInteger', // $120, not $120.00 - but $95.50, not $95.5
})

const _dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function formatPrice(price: number): string {
  return _priceFormatter.format(price)
}

function formatDate(ms: number): string {
  return _dateFormatter.format(ms)
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

// A label's colors as the --label-bg / --label-fg custom properties its pill SCSS reads
function getLabelStyle(label: CatLabel) {
  const { bg, fg } = LABEL_COLORS[label]
  return { '--label-bg': bg, '--label-fg': fg } as CSSProperties
}

// The first word of a full name, for short greetings: 'Ori Sason' → 'Ori'
function getFirstName(fullname: string) {
  return fullname.trim().split(/\s+/)[0]
}

function getFirstLetter(str: string) {
  return str.trim().charAt(0).toUpperCase()
}

// For a loader's un-awaited promise. Only <Await> attaches a rejection handler, and only once
// it renders. If the user leaves before the page mounts, a failed call would log
// "Uncaught (in promise)". The no-op catch is a second listener: the same promise is returned,
// so <Await> still gets the rejection
function withSilentReject<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {})
  return promise
}

// A failed route action: show the error, stay on the page.
// An error status skips the loader reload, so a failing server can't swap the page for RouteError
function toActionError(err: unknown) {
  useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
  const status = err instanceof ApiError && err.status >= 400 ? err.status : 500
  return data(null, { status })
}

// Builds a route's shouldRevalidate that skips its reload after an action on actionPath or
// below it. By default, any action reloads every loader on the page. When a section has its own
// child route (e.g. the reviews on cat-details), an action on that section changes only the
// child's data: the parent opts out and the child still reloads. Everything else keeps the
// default. '/review' matches /review and /review/:id, not a look-alike such as /reviews-export
function skipReloadOnActionAt(actionPath: string): ShouldRevalidateFunction {
  return ({ formAction, defaultShouldRevalidate }) => {
    if (formAction === actionPath || formAction?.startsWith(`${actionPath}/`)) return false
    return defaultShouldRevalidate
  }
}

// Where to go after login / signup, given the ?redirectTo= value. Only same-site paths pass:
// '/cat/1' is fine, but '//evil.com' (protocol-relative) and 'https://evil.com' would
// leave the site - an open redirect a phishing link could abuse.
// Resolving against a placeholder origin, not just checking for '//', also catches
// '/\evil.com', which browsers read as '//evil.com'. If the origin changed, it left the site
function getSafeRedirectTo(redirectTo: string | null) {
  const DEFAULT_REDIRECT_TO = '/cat'
  const PLACEHOLDER_ORIGIN = 'http://placeholder.local'

  if (!redirectTo?.startsWith('/')) return DEFAULT_REDIRECT_TO

  const target = new URL(redirectTo, PLACEHOLDER_ORIGIN)
  if (target.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_REDIRECT_TO
  return target.pathname + target.search + target.hash
}

// The location state for a link into a cat's pages: "Back comes here", this page with its search
function buildBackToState({ pathname, search }: Location): BackToLocationState {
  return { backTo: pathname + search }
}

// Where Back / Cancel on a cat's pages return to. No state (a direct visit, or after a save's
// redirect): the plain list
function getBackTo(location: Location): string {
  return (location.state as BackToLocationState | null)?.backTo ?? '/cat'
}

export const utilService = {
  formatPrice,
  formatDate,
  getFitCount,
  getLabelStyle,
  getFirstName,
  getFirstLetter,
  withSilentReject,
  toActionError,
  skipReloadOnActionAt,
  getSafeRedirectTo,
  buildBackToState,
  getBackTo,
}
