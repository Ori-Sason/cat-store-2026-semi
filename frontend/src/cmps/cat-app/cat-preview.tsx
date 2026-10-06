import type React from 'react'
import { Link, useLocation } from 'react-router'
import type { Cat } from '@cat-store/shared'
import type { CatListLocationState } from '../../models/util'
import { utilService } from '../../services/util.service'
import { CatImg } from '../common/cat/cat-img'
import { CatLabels } from './cat-labels'

interface CatPreviewProps {
  cat: Cat
}

export const CatPreview: React.FC<CatPreviewProps> = ({ cat }) => {
  const location = useLocation()
  const state: CatListLocationState = { listSearch: location.search }

  return (
    <Link to={`/cat/${cat._id}`} state={state} className="cat-preview">
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
