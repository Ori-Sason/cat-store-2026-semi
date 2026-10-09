import type React from 'react'
import type { Cat } from '@cat-store/shared'
import { CatPreview } from '../common/cat/cat-preview'

interface CatListProps {
  cats: Cat[]
}

export const CatList: React.FC<CatListProps> = ({ cats }) => {
  if (!cats.length) return <p className="cat-list empty">No cats match these filters.</p>

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
