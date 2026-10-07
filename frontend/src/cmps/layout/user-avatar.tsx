import type React from 'react'
import { utilService } from '../../services/util.service'

interface UserAvatarProps {
  fullname: string
  size?: 'md' | 'lg'
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ fullname, size = 'md' }) => {
  return (
    <span className={`user-avatar ${size}`} aria-hidden="true">
      {utilService.getFirstLetter(fullname)}
    </span>
  )
}
