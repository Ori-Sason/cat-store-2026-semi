import type React from 'react'
import { Outlet } from 'react-router'
import { UserMessage } from '../common/util/user-message'

export const LayoutRoot: React.FC = () => {
  return (
    <>
      <Outlet />
      <UserMessage />
    </>
  )
}
