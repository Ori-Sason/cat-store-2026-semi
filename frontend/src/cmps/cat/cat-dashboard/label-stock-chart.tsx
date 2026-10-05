import type { CatLabelStats } from '@cat-store/shared'
import type React from 'react'
import { formatStockStats, toStockChartRows } from './label-chart.util'

interface Props {
  labelStats: CatLabelStats[]
}

export const LabelStockChart: React.FC<Props> = ({ labelStats }) => {
  const rows = toStockChartRows(labelStats)

  return (
    <div className="label-stock-chart">
      <ul className="rows clean-list">
        {rows.map((row) => (
          <li key={row.label} className="row">
            <span className="label">{row.label}</span>
            <div className="track" aria-hidden="true">
              <div
                className="in-stock"
                style={{ '--in-stock-pct': `${row.inStockPct}%` } as React.CSSProperties}
              />
            </div>
            <span className="stats">{formatStockStats(row)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
