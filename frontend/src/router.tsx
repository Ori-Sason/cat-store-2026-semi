import { data, type RouteObject } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'
import { RouteError } from './cmps/common/util/route-error'
import { CatApp } from './pages/cat-app/cat-app'
import { catAppLoader } from './pages/cat-app/cat-app.loader'
import { CatDashboard } from './pages/cat-dashboard/cat-dashboard'
import { catDashboardLoader } from './pages/cat-dashboard/cat-dashboard.loader'
import { CatDetails } from './pages/cat-details/cat-details'
import { catDetailsAction } from './pages/cat-details/cat-details.action'
import { catDetailsLoader } from './pages/cat-details/cat-details.loader'
import { CatEdit } from './pages/cat-edit/cat-edit'
import { catEditAction } from './pages/cat-edit/cat-edit.action'
import { catEditLoader } from './pages/cat-edit/cat-edit.loader'
import { Home } from './pages/home/home'
import { homeLoader } from './pages/home/home.loader'
import { LoginSignup } from './pages/login-signup/login-signup'
import { loginSignupAction } from './pages/login-signup/login-signup.action'

// Just the routes. main.tsx creates the router after loading the logged-in user, since
// createBrowserRouter runs the first page's loaders right away, and the cat-edit loader reads the user
export const routes: RouteObject[] = [
  {
    element: <LayoutRoot />,
    HydrateFallback: () => null,
    children: [
      // pages without app-header
      {
        errorElement: <RouteError />,
        children: [
          // One page and one action for both - the route decides the mode
          // Logged-in users aren't redirected away from /login. That's intended.
          {
            path: '/login',
            action: (args) => loginSignupAction(args, 'login'),
            element: <LoginSignup mode="login" />,
          },
          {
            path: '/signup',
            action: (args) => loginSignupAction(args, 'signup'),
            element: <LoginSignup mode="signup" />,
          },
        ],
      },
      {
        element: <LayoutApp />,
        children: [
          {
            // Pathless route - errors below render here, so the header and user messages stay on screen
            errorElement: <RouteError />,
            children: [
              // pages with app-header
              {
                path: '/',
                loader: homeLoader,
                element: <Home />,
              },
              {
                path: '/cat',
                loader: catAppLoader,
                element: <CatApp />,
              },
              {
                path: '/cat/:id',
                loader: catDetailsLoader,
                action: catDetailsAction,
                element: <CatDetails />,
              },
              {
                path: '/cat/new',
                loader: catEditLoader,
                action: catEditAction,
                element: <CatEdit />,
              },
              {
                path: '/cat/:id/edit',
                loader: catEditLoader,
                action: catEditAction,
                element: <CatEdit />,
              },
              {
                path: '/dashboard',
                loader: catDashboardLoader,
                element: <CatDashboard />,
              },
              {
                path: '/about',
                // Lazy: OpenLayers (~88 KB gz) loads only when someone opens /about
                lazy: {
                  Component: async () => (await import('./pages/about/about')).About,
                },
              },
              {
                path: '*',
                loader: () => {
                  throw data(null, { status: 404 })
                },
              },
            ],
          },
        ],
      },
    ],
  },
]
