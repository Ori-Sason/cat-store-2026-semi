import type React from 'react'
import type { CatInput } from '@cat-store/shared'
import { useLoaderData, useLocation, useNavigation, useSubmit } from 'react-router'
import { CatEditForm } from '../../cmps/cat-edit/cat-edit-form'
import type { CatListLocationState } from '../../models/util'
import type { catEditLoader } from './cat-edit.loader'

export const CatEdit: React.FC = () => {
  const { cat } = useLoaderData<typeof catEditLoader>()
  const location = useLocation()
  // The list filter this page came from (via details or "+ Add cat"), handed back on Cancel
  const listState = location.state as CatListLocationState | null
  const submit = useSubmit()
  const navigation = useNavigation()
  // formMethod stays set through the redirect's load, so Save can't fire twice
  const isSaving = !!navigation.formMethod

  function onSave(catInput: CatInput) {
    void submit(catInput, { method: 'post', encType: 'application/json' })
  }

  return (
    <section className="cat-edit">
      <h1>{cat ? 'Edit cat' : 'Add cat'}</h1>
      <CatEditForm
        // /cat/1/edit → /cat/2/edit keeps this route mounted; a new key resets the form state
        key={cat?._id ?? 'new'}
        cat={cat}
        isSaving={isSaving}
        cancelTo={cat ? `/cat/${cat._id}` : `/cat${listState?.listSearch ?? ''}`}
        cancelState={cat ? (listState ?? undefined) : undefined}
        onSave={onSave}
      />
    </section>
  )
}
