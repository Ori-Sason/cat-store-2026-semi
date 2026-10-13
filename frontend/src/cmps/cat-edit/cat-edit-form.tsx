import type React from 'react'
import { Link } from 'react-router'
import { CAT_LABELS, catSchema, type CatInput, type CatLabel } from '@cat-store/shared'
import type { BackToLocationState } from '../../models/util'
import { useForm } from '../../hooks/use-form'
import { FieldError } from '../common/util/field-error'
import { ToggleSwitch } from '../common/util/toggle-switch'
import { CatImg } from '../common/cat/cat-img'
import { LabelToggles } from '../common/cat/label-toggles'

// Price stays a string while typing, so an empty field shows empty instead of 0
type CatForm = Omit<CatInput, 'price'> & { price: string }

const _EMPTY_FORM: CatForm = { name: '', price: '', labels: [], isInStock: true, imgUrl: '' }

function _toForm(cat: CatInput | null): CatForm {
  if (!cat) return _EMPTY_FORM
  const { name, price, labels, isInStock, imgUrl } = cat
  return { name, price: String(price), labels, isInStock, imgUrl }
}

function _toCatInput(form: CatForm) {
  return { ...form, price: form.price.trim() === '' ? undefined : Number(form.price) }
}

interface CatEditFormProps {
  // The cat being edited (null = add). Only its editable fields are read
  cat: CatInput | null
  isSaving: boolean
  cancelTo: string
  cancelState?: BackToLocationState
  onSave: (catInput: CatInput) => void
}

export const CatEditForm: React.FC<CatEditFormProps> = ({
  cat,
  isSaving,
  cancelTo,
  cancelState,
  onSave,
}) => {
  const { form, setField, getTextFieldProps, getErrorProps, onSubmit } = useForm({
    initialForm: () => _toForm(cat),
    schema: catSchema,
    idPrefix: 'cat',
    toInput: _toCatInput,
    onValidSubmit: onSave,
  })

  function onSetLabels(labels: CatLabel[]) {
    setField('labels', labels)
  }

  return (
    <form className="cat-edit-form" noValidate onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="cat-name">Name</label>
        <input type="text" {...getTextFieldProps('name')} />
        <FieldError {...getErrorProps('name')} />
      </div>

      <div className="field">
        <label htmlFor="cat-price">Price ($)</label>
        <input type="text" inputMode="decimal" {...getTextFieldProps('price')} />
        <FieldError {...getErrorProps('price')} />
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
        onChange={(isInStock) => setField('isInStock', isInStock)}
      />

      <div className="field">
        <label htmlFor="cat-imgUrl">Image URL</label>
        <div className="img-row">
          <CatImg cat={{ name: form.name, imgUrl: form.imgUrl }} isSoldOutShown={false} />
          <div className="img-input">
            <input type="url" {...getTextFieldProps('imgUrl', 'cat-imgUrl-hint')} />
            <p id="cat-imgUrl-hint" className="hint">
              Leave empty to use the default cat image
            </p>
            <FieldError {...getErrorProps('imgUrl')} />
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
