import type React from 'react'
import { useState } from 'react'
import type { Cat } from '@cat-store/shared'
import defaultImg from '../../../assets/img/cat-default-bw.png'
import soldOutImg from '../../../assets/img/sold-out.png'

interface CatImgProps {
  cat: Pick<Cat, 'name' | 'imgUrl' | 'isInStock'>
  isSoldOutShown?: boolean
}

export const CatImg: React.FC<CatImgProps> = ({ cat, isSoldOutShown = true }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const src = cat.imgUrl && cat.imgUrl !== failedUrl ? cat.imgUrl : defaultImg
  const isSoldOut = isSoldOutShown && !cat.isInStock

  return (
    <div className={`cat-img ${isSoldOut ? 'sold-out' : ''}`}>
      <img className="photo" src={src} alt={cat.name} onError={() => setFailedUrl(cat.imgUrl)} />
      {isSoldOut && <img className="badge" src={soldOutImg} alt="Sold out" />}
    </div>
  )
}
