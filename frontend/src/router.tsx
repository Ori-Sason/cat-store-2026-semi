import { data, type RouteObject } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'
import { CatReviews } from './cmps/cat-details/cat-reviews'
import { UserCats } from './cmps/user-details/user-cats'
import { UserReviews } from './cmps/user-details/user-reviews'
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
import { reviewAction } from './pages/review/review.action'
import { reviewLoader } from './pages/review/review.loader'
import { userCatsLoader } from './pages/user-details/user-cats.loader'
import { UserDetails } from './pages/user-details/user-details'
import { userDetailsLoader } from './pages/user-details/user-details.loader'
import { utilService } from './services/util.service'

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
                // A review action reloads only the reviews child below, not the cat
                shouldRevalidate: utilService.skipReloadOnActionAt('/review'),
                element: <CatDetails />,
                children: [
                  // The reviews section, with its own loader so it can reload alone.
                  // The cat delete fetcher still hits the parent's action: a submit to
                  // /cat/:id without ?index targets the parent, not this index route
                  {
                    index: true,
                    loader: (args) => reviewLoader(args, 'catId'),
                    element: <CatReviews />,
                  },
                ],
              },
              {
                path: '/user/:id',
                loader: userDetailsLoader,
                // A review action on a tab reloads only that tab, not the user
                // No errorElement here: it would catch the tabs' errors too and hide the header.
                // The tab loaders are deferred, so a failed tab shows in its own <Await errorElement>
                shouldRevalidate: utilService.skipReloadOnActionAt('/review'),
                element: <UserDetails />,
                children: [
                  // One child route per tab, each with its own loader. Only the open tab loads.
                  // The cats tab is an index route, not a redirect: it gets one URL, and Back never bounces
                  { index: true, loader: userCatsLoader, element: <UserCats /> },
                  {
                    path: 'reviews',
                    loader: (args) => reviewLoader(args, 'userId'),
                    element: <UserReviews />,
                  },
                ],
              },
              {
                // Action-only: the review fetchers post here. A typed-in visit
                // runs the loader, which 404s instead of showing an empty page. Fetchers never
                // run it: after their action, react-router reloads the current page's loaders
                path: '/review',
                loader: _notFoundLoader,
                action: reviewAction,
              },
              {
                // Action-only, like /review: a review's edit (PUT) and delete (DELETE)
                path: '/review/:id',
                loader: _notFoundLoader,
                action: reviewAction,
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
                loader: _notFoundLoader,
              },
            ],
          },
        ],
      },
    ],
  },
]

function _notFoundLoader(): never {
  throw data(null, { status: 404 })
}
