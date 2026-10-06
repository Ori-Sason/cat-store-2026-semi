import type React from 'react'
import { useState } from 'react'
import { Link, useFetcher, useLoaderData, useLocation } from 'react-router'
import { CatImg } from '../../cmps/common/cat/cat-img'
import { LabelChip } from '../../cmps/common/cat/label-chip'
import { ConfirmModal } from '../../cmps/common/util/confirm-modal'
import type { CatListLocationState } from '../../models/util'
import { utilService } from '../../services/util.service'
import type { catDetailsLoader } from './cat-details.loader'

export const CatDetails: React.FC = () => {
  const { cat } = useLoaderData<typeof catDetailsLoader>()
  const location = useLocation()
  const listSearch = (location.state as CatListLocationState | null)?.listSearch ?? ''
  const fetcher = useFetcher()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const isDeleting = fetcher.state !== 'idle'

  function onConfirmDelete() {
    setIsConfirmOpen(false)
    void fetcher.submit(null, { method: 'delete' })
  }

  return (
    <section className="cat-details">
      <Link to={`/cat${listSearch}`} className="back-link">
        ← Back to cats
      </Link>

      <article className="panel">
        <CatImg cat={cat} />
        <div className="info">
          <h1>{cat.name}</h1>
          <div className="price-row">
            <span className="price">{utilService.formatPrice(cat.price)}</span>
            <span className={`stock ${cat.isInStock ? 'in-stock' : 'sold-out'}`}>
              {cat.isInStock ? 'In stock' : 'Sold out'}
            </span>
          </div>
          {cat.labels.length > 0 && (
            <ul className="labels clean-list">
              {cat.labels.map((label) => (
                <li key={label}>
                  <LabelChip label={label} />
                </li>
              ))}
            </ul>
          )}
          <p className="added">Added {utilService.formatDate(cat.createdAt)}</p>
          <div className="actions">
            <Link to={`/cat/${cat._id}/edit`} state={{ listSearch }} className="main-btn">
              Edit
            </Link>
            <button
              type="button"
              className="danger-outline-btn"
              disabled={isDeleting}
              onClick={() => setIsConfirmOpen(true)}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
        <div className="placeholder">Reviews and chat are coming soon</div>
      </article>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title={`Delete ${cat.name}?`}
        msg="This can't be undone."
        confirmTxt="Delete"
        onConfirm={onConfirmDelete}
        onClose={() => setIsConfirmOpen(false)}
      />
    </section>
  )
}
