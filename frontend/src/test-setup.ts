import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL auto-cleanup only hooks in with `globals: true`; we run with globals off
afterEach(() => {
  cleanup()
})
