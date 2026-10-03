import type React from 'react'
import { Outlet } from 'react-router'
// import { AppHeader } from './app-header'

export const LayoutApp: React.FC = () => {
  return (
    <>
      {/* <AppHeader /> */}
      <Outlet />
    </>
  )
}
