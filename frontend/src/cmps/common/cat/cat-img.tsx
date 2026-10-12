import type React from 'react'
import { useState } from 'react'
import type { Cat } from '@cat-store/shared'
import defaultImg from '../../../assets/img/cat-default-bw.png'
import soldOutImg from '../../../assets/img/sold-out.png'

// isSoldOutShown is required, so every caller decides on the badge. When it's on, the cat must
// carry isInStock: a cat ref without it (a review's cat) can't silently drop the badge
type CatImgProps = {
  // '' when the cat's name is already next to the image, so a screen reader doesn't read it twice
  alt?: string
} & (
  | { isSoldOutShown: true; cat: Pick<Cat, 'name' | 'imgUrl' | 'isInStock'> }
  | { isSoldOutShown: false; cat: Pick<Cat, 'name' | 'imgUrl'> }
)

export const CatImg: React.FC<CatImgProps> = ({ cat, isSoldOutShown, alt = cat.name }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const src = cat.imgUrl && cat.imgUrl !== failedUrl ? cat.imgUrl : defaultImg
  const isSoldOut = isSoldOutShown && !cat.isInStock

  return (
    <div className={`cat-img ${isSoldOut ? 'sold-out' : ''}`}>
      <img className="photo" src={src} alt={alt} onError={() => setFailedUrl(cat.imgUrl)} />
      {isSoldOut && <img className="badge" src={soldOutImg} alt="Sold out" />}
    </div>
  )
}
