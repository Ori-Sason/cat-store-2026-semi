import type React from 'react'
import { useLoaderData } from 'react-router'
import { LabelPriceChart } from '../../cmps/cat/cat-dashboard/label-price-chart'
import { LabelStockChart } from '../../cmps/cat/cat-dashboard/label-stock-chart'
import type { catDashboardLoader } from './cat-dashboard.loader'

export const CatDashboard: React.FC = () => {
  const { labelStats } = useLoaderData<typeof catDashboardLoader>()
  // Also true when cats exist but none has a label - there's nothing to chart either way
  const isEmpty = labelStats.every((s) => s.count === 0)

  return (
    <section className="cat-dashboard">
      <h1>Dashboard</h1>

      {isEmpty ? (
        <p className="panel empty">No cats yet</p>
      ) : (
        <>
          <section className="panel">
            <h2>Price per label</h2>
            <p className="hint">Line: cheapest to priciest. Marker: median.</p>
            <LabelPriceChart labelStats={labelStats} />
          </section>

          <section className="panel">
            <h2>In stock per label</h2>
            <LabelStockChart labelStats={labelStats} />
          </section>

          <p className="disclaimer" role="note">
            A cat can have several labels, so it counts once per label. Cats with no labels aren't
            shown.
          </p>
        </>
      )}
    </section>
  )
}
