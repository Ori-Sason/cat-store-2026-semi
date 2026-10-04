import type React from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { CAT_LABELS, catSchema, type Cat, type CatInput, type CatLabel } from '@cat-store/shared'
import type { CatListLocationState } from '../../../models/util'
import { ToggleSwitch } from '../../util/toggle-switch'
import { CatImg } from '../cat-img'
import { LabelToggles } from '../label-toggles'

// Price stays a string while typing, so an empty field shows empty instead of 0
type CatForm = Omit<CatInput, 'price'> & { price: string }
type CatTextField = 'name' | 'price' | 'imgUrl'

const _EMPTY_FORM: CatForm = { name: '', price: '', labels: [], isInStock: true, imgUrl: '' }

function _toForm(cat: Cat | null): CatForm {
  if (!cat) return _EMPTY_FORM
  const { name, price, labels, isInStock, imgUrl } = cat
  return { name, price: String(price), labels, isInStock, imgUrl }
}

function _toCatInput(form: CatForm) {
  return { ...form, price: form.price.trim() === '' ? undefined : Number(form.price) }
}

interface CatEditFormProps {
  cat: Cat | null
  isSaving: boolean
  cancelTo: string
  cancelState?: CatListLocationState
  onSave: (catInput: CatInput) => void
}

export const CatEditForm: React.FC<CatEditFormProps> = ({
  cat,
  isSaving,
  cancelTo,
  cancelState,
  onSave,
}) => {
  const [form, setForm] = useState(() => _toForm(cat))
  const [touched, setTouched] = useState<Partial<Record<CatTextField, boolean>>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const result = catSchema.safeParse(_toCatInput(form))
  const fieldErrors = result.success ? {} : z.flattenError(result.error).fieldErrors

  function getError(field: CatTextField) {
    return touched[field] || isSubmitted ? fieldErrors[field]?.[0] : undefined
  }

  function getTextFieldProps(field: CatTextField, hintId?: string) {
    const error = getError(field)
    const describedBy = [hintId, error && `cat-${field}-error`].filter(Boolean).join(' ')
    return {
      id: `cat-${field}`,
      value: form[field],
      onChange: (ev: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: ev.target.value })),
      onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
      'aria-invalid': !!error,
      'aria-describedby': describedBy || undefined,
    }
  }

  function renderError(field: CatTextField) {
    const error = getError(field)
    if (!error) return null
    return (
      <p id={`cat-${field}-error`} className="field-error">
        {error}
      </p>
    )
  }

  function onSetLabels(labels: CatLabel[]) {
    setForm((prev) => ({ ...prev, labels }))
  }

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    setIsSubmitted(true)
    if (result.success) onSave(result.data)
  }

  return (
    <form className="cat-edit-form" noValidate onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="cat-name">Name</label>
        <input type="text" {...getTextFieldProps('name')} />
        {renderError('name')}
      </div>

      <div className="field">
        <label htmlFor="cat-price">Price ($)</label>
        <input type="text" inputMode="decimal" {...getTextFieldProps('price')} />
        {renderError('price')}
      </div>

      <div className="field">
        <div className="field-head">
          <span id="cat-labels-title" className="field-title">
            Labels
          </span>
          <button
            type="button"
            className="text-btn"
            disabled={form.labels.length === CAT_LABELS.length}
            onClick={() => onSetLabels([...CAT_LABELS])}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-btn"
            disabled={form.labels.length === 0}
            onClick={() => onSetLabels([])}
          >
            Remove all
          </button>
        </div>
        <LabelToggles
          labels={form.labels}
          onChange={onSetLabels}
          aria-labelledby="cat-labels-title"
        />
      </div>

      <ToggleSwitch
        label="In stock"
        isChecked={form.isInStock}
        onChange={(isInStock) => setForm((prev) => ({ ...prev, isInStock }))}
      />

      <div className="field">
        <label htmlFor="cat-imgUrl">Image URL</label>
        <div className="img-row">
          <CatImg
            cat={{ name: form.name, imgUrl: form.imgUrl, isInStock: form.isInStock }}
            isSoldOutShown={false}
          />
          <div className="img-input">
            <input type="url" {...getTextFieldProps('imgUrl', 'cat-imgUrl-hint')} />
            <p id="cat-imgUrl-hint" className="hint">
              Leave empty to use the default cat image
            </p>
            {renderError('imgUrl')}
          </div>
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="main-btn" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <Link to={cancelTo} state={cancelState} className="sub-btn">
          Cancel
        </Link>
      </div>
    </form>
  )
}
