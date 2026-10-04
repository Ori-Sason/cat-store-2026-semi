import type React from 'react'
import { Link } from 'react-router'
import type { Cat } from '@cat-store/shared'
import { utilService } from '../../services/util.service'
import { CatImg } from './cat-img'
import { LabelChip } from './label-chip'

const MAX_LABELS_SHOWN = 2

interface CatPreviewProps {
  cat: Cat
}

export const CatPreview: React.FC<CatPreviewProps> = ({ cat }) => {
  const hiddenLabelCount = cat.labels.length - MAX_LABELS_SHOWN

  return (
    <Link to={`/cat/${cat._id}`} className="cat-preview">
      <CatImg cat={cat} />
      <div className="body">
        <div className="top">
          <h3>{cat.name}</h3>
          <span className="price">{utilService.formatPrice(cat.price)}</span>
        </div>
        <div className="labels">
          {cat.labels.slice(0, MAX_LABELS_SHOWN).map((label) => (
            <LabelChip key={label} label={label} />
          ))}
          {hiddenLabelCount > 0 && <span className="more">+{hiddenLabelCount}</span>}
        </div>
      </div>
    </Link>
  )
}
