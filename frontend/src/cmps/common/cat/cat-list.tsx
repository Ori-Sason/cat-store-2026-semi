import type React from 'react'
import type { CatWithRefs } from '@cat-store/shared'
import { CatPreview } from './cat-preview'

interface CatListProps {
  cats: CatWithRefs[]
  emptyText: string // each page says why it has none: no filter match, or no cats yet
  isOwnerShown: boolean
}

export const CatList: React.FC<CatListProps> = ({ cats, emptyText, isOwnerShown }) => {
  if (!cats.length) return <p className="cat-list empty">{emptyText}</p>

  return (
    <ul className="cat-list clean-list">
      {cats.map((cat) => (
        <li key={cat._id}>
          <CatPreview cat={cat} isOwnerShown={isOwnerShown} />
        </li>
      ))}
    </ul>
  )
}
