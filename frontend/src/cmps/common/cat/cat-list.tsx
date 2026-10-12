import type React from 'react'
import type { Cat } from '@cat-store/shared'
import { CatPreview } from './cat-preview'

interface CatListProps {
  cats: Cat[]
  emptyText: string // each page says why it has none: no filter match, or no cats yet
}

export const CatList: React.FC<CatListProps> = ({ cats, emptyText }) => {
  if (!cats.length) return <p className="cat-list empty">{emptyText}</p>

  return (
    <ul className="cat-list clean-list">
      {cats.map((cat) => (
        <li key={cat._id}>
          <CatPreview cat={cat} />
        </li>
      ))}
    </ul>
  )
}
