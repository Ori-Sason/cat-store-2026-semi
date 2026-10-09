import type React from 'react'
import { Suspense } from 'react'
import { Await, Link } from 'react-router'
import type { CatLabelStats } from '@cat-store/shared'
import { LABEL_COLORS } from '../../models/label'
import { utilService } from '../../services/util.service'
import { HomeSectionError } from './home-section-error'
import { LabelPriceTeaserSkeleton } from './label-price-teaser-skeleton'
import { pickPriceTeaserRows } from './label-price-teaser.util'

interface LabelPriceTeaserProps {
  labelStats: Promise<CatLabelStats[]> // from the home loader, un-awaited
}

// The card and its heading render right away. Only the bars wait on the API
export const LabelPriceTeaser: React.FC<LabelPriceTeaserProps> = ({ labelStats }) => {
  return (
    <section className="label-price-teaser">
      <div className="head">
        <h2>Median price by label</h2>
        <Link to="/dashboard">
          Open the dashboard <span aria-hidden="true">→</span>
        </Link>
      </div>

      <Suspense fallback={<LabelPriceTeaserSkeleton />}>
        <Await resolve={labelStats} errorElement={<HomeSectionError />}>
          {(stats) => {
            const rows = pickPriceTeaserRows(stats)
            if (!rows.length) return <p className="empty">No labelled cats yet</p>

            return (
              <ul className="clean-list bars">
                {rows.map(({ label, medianPrice, barPct }) => (
                  <li key={label} className="bar-row">
                    <span className="name">{label}</span>
                    <span className="track" aria-hidden="true">
                      <span
                        className="fill"
                        style={{ width: `${barPct}%`, backgroundColor: LABEL_COLORS[label].fg }}
                      />
                    </span>
                    <span className="val">{utilService.formatPrice(medianPrice)}</span>
                  </li>
                ))}
              </ul>
            )
          }}
        </Await>
      </Suspense>
    </section>
  )
}
