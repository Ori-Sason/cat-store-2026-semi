import type { CatLabelStats } from '@cat-store/shared'
import type React from 'react'
import { utilService } from '../../../services/util.service'
import { formatPriceStats, getPriceAxis, toPriceChartRows } from './label-chart.util'

interface Props {
  labelStats: CatLabelStats[]
}

export const LabelPriceChart: React.FC<Props> = ({ labelStats }) => {
  const axis = getPriceAxis(labelStats)
  const rows = toPriceChartRows(labelStats, axis.max)

  return (
    <div className="label-price-chart">
      <ul className="rows clean-list">
        {rows.map((row) => (
          <li key={row.label} className="row">
            <span className="label">{row.label}</span>
            <div
              className="track"
              aria-hidden="true"
              style={
                row.pricePcts
                  ? ({
                      '--min-pct': `${row.pricePcts.min}%`,
                      '--max-pct': `${row.pricePcts.max}%`,
                      '--median-pct': `${row.pricePcts.median}%`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {row.pricePcts && (
                <>
                  <span className="range" />
                  <span className="median" />
                </>
              )}
            </div>
            <span className="stats">{formatPriceStats(row)}</span>
          </li>
        ))}
      </ul>

      <div className="axis" aria-hidden="true">
        {axis.ticks.map((tick) => (
          <span
            key={tick.value}
            className="axis-label"
            style={{ '--tick-pct': `${tick.pct}%` } as React.CSSProperties}
          >
            {utilService.formatPrice(tick.value)}
          </span>
        ))}
      </div>
    </div>
  )
}
