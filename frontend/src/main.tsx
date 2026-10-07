import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { authService } from './services/auth.service'
import { useLoggedInUserStore } from './store/logged-in-user.store'
import './assets/scss/main.scss'

// Load the logged-in user before the first render, so the header and every loader
// see the right user from the start.
try {
  const loggedInUser = await authService.getLoggedInUser()
  if (loggedInUser) useLoggedInUserStore.getState().setLoggedInUser(loggedInUser)
} catch {
  // Server down or unreachable - start as a guest; the pages show their own errors
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
