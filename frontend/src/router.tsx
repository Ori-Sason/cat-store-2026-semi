import { createBrowserRouter, data } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'
import { RouteError } from './cmps/util/route-error'

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
                element: <div>EMPTY</div>,
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
