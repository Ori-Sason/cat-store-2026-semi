import type React from 'react'
import { useState } from 'react'
import { Link, Outlet, useFetcher, useLoaderData, useLocation } from 'react-router'
import { catPermissionService } from '@cat-store/shared'
import { CatChat } from '../../cmps/cat-details/cat-chat/cat-chat'
import { CatImg } from '../../cmps/common/cat/cat-img'
import { LabelChip } from '../../cmps/common/cat/label-chip'
import { ConfirmModal } from '../../cmps/common/util/confirm-modal'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import type { catDetailsLoader } from './cat-details.loader'

export const CatDetails: React.FC = () => {
  const { cat } = useLoaderData<typeof catDetailsLoader>()
  const location = useLocation()
  const backTo = utilService.getBackTo(location)
  const fetcher = useFetcher()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const isDeleting = fetcher.state !== 'idle'
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const isCanEdit = catPermissionService.canEditCat(cat.owner._id, loggedInUser)

  function onConfirmDelete() {
    setIsConfirmOpen(false)
    void fetcher.submit(null, { method: 'delete' })
  }

  return (
    <section className="cat-details">
      <Link to={backTo} className="back-link">
        ← Back to {_getBackLabel(backTo)}
      </Link>

      <article className="panel">
        <CatImg cat={cat} isSoldOutShown />
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
          <p className="owner">
            Owner: <Link to={`/user/${cat.owner._id}`}>{cat.owner.fullname}</Link>
          </p>
          <p className="added">Added {utilService.formatDate(cat.createdAt)}</p>
          {isCanEdit && (
            <div className="actions">
              <Link to={`/cat/${cat._id}/edit`} state={{ backTo }} className="main-btn">
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
          )}
        </div>
      </article>

      {/* The reviews: a child route with its own loader (CatReviews) */}
      <Outlet />

      {/* Keyed by cat: a /cat/A → /cat/B switch reuses this page, and every piece of chat state
          (the open panel, the delete confirm, the draft text) belongs to the old cat */}
      <CatChat
        key={cat._id}
        catId={cat._id}
        catName={cat.name}
        catOwnerId={cat.owner._id}
        isCatDeleting={isDeleting}
      />

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

// The back link names the page it returns to. Only the app's own links set backTo, so these
// three cover every origin
function _getBackLabel(backTo: string) {
  const pathname = backTo.split('?')[0]
  if (pathname === '/') return 'home'
  if (pathname?.startsWith('/user/')) return 'profile'
  return 'cats'
}
