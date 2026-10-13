import type React from 'react'
import { Link, useLocation } from 'react-router'
import type { CatWithRefs } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'
import { CatImg } from './cat-img'
import { CatLabels } from './cat-labels'

interface CatPreviewProps {
  cat: CatWithRefs
  // false where the page already says whose cats they are (the user page's cats tab)
  isOwnerShown: boolean
}

// The owner is plain text, not a link to /user/:id: the whole card is a <Link>, and a link
// inside it would be a nested <a>. cat-details has the owner link.
// Decided against a stretched-link card (would allow an owner link): a bigger markup / SCSS /
// test change for a small gain
export const CatPreview: React.FC<CatPreviewProps> = ({ cat, isOwnerShown }) => {
  const location = useLocation()

  return (
    <Link
      to={`/cat/${cat._id}`}
      state={utilService.buildBackToState(location)}
      className="cat-preview"
    >
      <CatImg cat={cat} isSoldOutShown />
      <div className="body">
        <div className="top">
          <h3>{cat.name}</h3>
          {isOwnerShown && <span className="owner">by {cat.owner.fullname}</span>}
          <span className="price">{utilService.formatPrice(cat.price)}</span>
        </div>
        <CatLabels key={cat.labels.join()} labels={cat.labels} />
      </div>
    </Link>
  )
}
