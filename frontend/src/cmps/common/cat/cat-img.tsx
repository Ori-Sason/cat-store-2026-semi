import type React from 'react'
import { useState } from 'react'
import type { Cat } from '@cat-store/shared'
import defaultImg from '../../../assets/img/cat-default-bw.png'
import soldOutImg from '../../../assets/img/sold-out.png'

interface CatImgProps {
  // isInStock is optional for a cat ref that doesn't carry it (a review's cat): no badge then
  cat: Pick<Cat, 'name' | 'imgUrl'> & Partial<Pick<Cat, 'isInStock'>>
  isSoldOutShown?: boolean
  // '' when the cat's name is already next to the image, so a screen reader doesn't read it twice
  alt?: string
}

export const CatImg: React.FC<CatImgProps> = ({ cat, isSoldOutShown = true, alt = cat.name }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const src = cat.imgUrl && cat.imgUrl !== failedUrl ? cat.imgUrl : defaultImg
  const isSoldOut = isSoldOutShown && cat.isInStock === false

  return (
    <div className={`cat-img ${isSoldOut ? 'sold-out' : ''}`}>
      <img className="photo" src={src} alt={alt} onError={() => setFailedUrl(cat.imgUrl)} />
      {isSoldOut && <img className="badge" src={soldOutImg} alt="Sold out" />}
    </div>
  )
}
