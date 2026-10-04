import { createBrowserRouter, data, redirect } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'
import { RouteError } from './cmps/util/route-error'
import { CatApp } from './pages/cat-app/cat-app'
import { catAppLoader } from './pages/cat-app/cat-app.loader'

export const router = createBrowserRouter([
  {
    element: <LayoutRoot />,
    children: [
      // pages without app-header
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
                loader: () => redirect('/cat'),
              },
              {
                path: '/cat',
                loader: catAppLoader,
                element: <CatApp />,
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
])
