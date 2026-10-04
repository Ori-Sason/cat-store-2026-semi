import type React from 'react'
import { Link } from 'react-router'
import type { Cat } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'
import { CatImg } from '../cat-img'
import { CatLabels } from './cat-labels'

interface CatPreviewProps {
  cat: Cat
}

export const CatPreview: React.FC<CatPreviewProps> = ({ cat }) => {
  return (
    <Link to={`/cat/${cat._id}`} className="cat-preview">
      <CatImg cat={cat} />
      <div className="body">
        <div className="top">
          <h3>{cat.name}</h3>
          <span className="price">{utilService.formatPrice(cat.price)}</span>
        </div>
        <CatLabels key={cat.labels.join()} labels={cat.labels} />
      </div>
    </Link>
  )
}
