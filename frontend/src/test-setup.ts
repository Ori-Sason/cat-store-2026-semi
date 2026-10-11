import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
// jsdom has no canvas - OpenLayers (about-page map) draws tiles and markers to one
import 'vitest-canvas-mock'

// RTL auto-cleanup only hooks in with `globals: true`; we run with globals off
afterEach(() => {
  cleanup()
})

// jsdom has no layout, so no ResizeObserver - a no-op keeps layout hooks (useFitCount) mountable
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom has no matchMedia - a query that never matches or changes keeps media-query effects
// (AppHeader's breakpoint listener) mountable. A test that needs a change spies on it
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) satisfies MediaQueryList

// jsdom has <dialog> but no showModal/close - stub the parts ConfirmModal relies on
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}

// jsdom has no Popover API, and its default stylesheet hides every [popover] (it never matches
// :popover-open). Emulate what the popover menus use: show / hide / toggle flip an inline
// display, and a click on a popovertarget button toggles its popover, as a browser does
function _setPopoverOpen(el: HTMLElement, isOpen: boolean) {
  el.style.display = isOpen ? 'block' : ''
  return isOpen
}
HTMLElement.prototype.showPopover ??= function (this: HTMLElement) {
  _setPopoverOpen(this, true)
}
HTMLElement.prototype.hidePopover ??= function (this: HTMLElement) {
  _setPopoverOpen(this, false)
}
HTMLElement.prototype.togglePopover ??= function (this: HTMLElement) {
  return _setPopoverOpen(this, this.style.display !== 'block')
}
document.addEventListener('click', (ev) => {
  const invoker = (ev.target as Element).closest('button[popovertarget]') as HTMLButtonElement
  if (!invoker || invoker.disabled) return
  document.getElementById(invoker.getAttribute('popovertarget')!)?.togglePopover()
})
