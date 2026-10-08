import type React from 'react'
import { Link } from 'react-router'
import { CAT_LABELS, catFilterService, DEFAULT_CAT_FILTER, type CatLabel } from '@cat-store/shared'
import catImg from '../../assets/img/cat-default-color.png'
import { LabelChip } from '../common/cat/label-chip'

interface HomeHeroProps {
  firstName: string | null // null for a guest
}

// Static on purpose: the hero renders right away and never waits on the API.
// The floating chips and the price tag are decoration, not real cat data
export const HomeHero: React.FC<HomeHeroProps> = ({ firstName }) => {
  return (
    <section className="home-hero">
      <div className="intro">
        <p className="eyebrow">
          {firstName ? `Welcome back, ${firstName}` : 'Browse · Meet · Pick up'}
        </p>
        <h1>
          Meet your next cat at <em>a pickup point</em> near you.
        </h1>
        <p className="lede">
          Browse cats with real, comparable details. Talk to the owner. Then pick your cat up in
          person.
        </p>
        <div className="ctas">
          <Link to="/cat" className="main-btn">
            Browse cats <span aria-hidden="true">→</span>
          </Link>
          {firstName ? (
            <Link to="/cat/new" className="sub-btn">
              + Add a cat
            </Link>
          ) : (
            <Link to="/login" className="sub-btn">
              Log in
            </Link>
          )}
        </div>
        {!firstName && (
          <p className="fine">
            New here? <Link to="/signup">Create an account</Link> to list your own cat.
          </p>
        )}
      </div>

      <div className="art" aria-hidden="true">
        <div className="ring" />
        <div className="disc" />
        <img src={catImg} alt="" />
        <LabelChip label="Playful" className="float f1" />
        <LabelChip label="Good with kids" className="float f2" />
        <LabelChip label="Kitten" className="float f3" />
        <div className="price-tag">
          <small>Miso, 4 months</small>
          <strong>$450</strong>
          <span className="stock">● In stock</span>
        </div>
      </div>

      <div className="labels">
        <p>Start with a label</p>
        <ul className="clean-list">
          {CAT_LABELS.map((label) => (
            <li key={label}>
              <Link to={_getLabelUrl(label)}>
                <LabelChip label={label} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// Built through catFilterService, so the link stays in step with how /cat reads its query
function _getLabelUrl(label: CatLabel): string {
  const filterBy = { ...DEFAULT_CAT_FILTER, labels: [label] }
  return `/cat?${new URLSearchParams(catFilterService.filterToParams(filterBy))}`
}
