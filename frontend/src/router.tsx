import { createBrowserRouter, data } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'

export const router = createBrowserRouter([
  {
    element: <LayoutRoot />,
    // errorElement: <RouteErrorPage />, // last resort - e.g. a crash inside a layout itself
    children: [
      // pages without app-header
      {
        element: <LayoutApp />,
        children: [
          {
            // Pathless route - errors below render here, so the header and user messages stay on screen
            // errorElement: <RouteErrorPage />,
            children: [
              // pages with app-header
              {
                path: '/',
                element: <div>EMPTY</div>},
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
