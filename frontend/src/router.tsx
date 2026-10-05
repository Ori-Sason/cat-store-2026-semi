import { createBrowserRouter, data, redirect } from 'react-router'
import { LayoutApp } from './cmps/layout/layout-app'
import { LayoutRoot } from './cmps/layout/layout-root'
import { RouteError } from './cmps/util/route-error'
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
