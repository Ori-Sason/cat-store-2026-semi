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

// jsdom has <dialog> but no showModal/close - stub the parts ConfirmModal relies on
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}
