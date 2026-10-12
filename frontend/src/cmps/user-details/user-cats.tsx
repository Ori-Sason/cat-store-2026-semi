import type React from 'react'
import { Suspense } from 'react'
import { Await, useLoaderData, useParams } from 'react-router'
import type { userCatsLoader } from '../../pages/user-details/user-cats.loader'
import { CatList } from '../common/cat/cat-list'
import { CatListSkeleton } from '../common/cat/cat-list-skeleton'
import { SectionError } from '../common/util/section-error'

const _SKELETON_CARD_COUNT = 4

// The cats tab of /user/:id, rendered through user-details' <Outlet>.
// The key remounts the <Suspense> per user. Without it, going from one user page to another
// keeps the first user's cats on screen under the new header until the new list arrives:
// a <Suspense> already on screen doesn't fall back again during a navigation
export const UserCats: React.FC = () => {
  const { cats } = useLoaderData<typeof userCatsLoader>()
  const userId = useParams().id!

  return (
    <section className="user-cats">
      <Suspense key={userId} fallback={<CatListSkeleton count={_SKELETON_CARD_COUNT} />}>
        <Await resolve={cats} errorElement={<SectionError />}>
          {(cats) => <CatList cats={cats} emptyText="No cats listed yet." />}
        </Await>
      </Suspense>
    </section>
  )
}
