import type React from 'react'
import { Link } from 'react-router'

interface HowItWorksStep {
  title: string
  txt: string
  link?: { to: string; txt: string }
  isSoon?: boolean // the feature isn't built yet (reviews and chat come in Parts 5–6)
}

const _STEPS: HowItWorksStep[] = [
  {
    title: 'Browse',
    txt: 'Filter by label, stock and name. Sort by price or by newest.',
    link: { to: '/cat', txt: 'Browse cats →' },
  },
  {
    title: 'Meet',
    txt: 'Read reviews of the cat and chat live with others looking at it.',
    isSoon: true,
  },
  {
    title: 'Pick up',
    txt: 'Arrange the handover with the owner and meet at one of our pickup points.',
    link: { to: '/about', txt: 'See pickup points →' },
  },
]

export const HowItWorks: React.FC = () => {
  return (
    <section className="how-it-works">
      <h2>How it works</h2>
      <ol className="clean-list steps">
        {_STEPS.map(({ title, txt, link, isSoon }, idx) => (
          <li key={title} className="step">
            <span className="num" aria-hidden="true">
              {idx + 1}
            </span>
            <h3>
              {title} {isSoon && <span className="soon">Soon</span>}
            </h3>
            <p>{txt}</p>
            {link && <Link to={link.to}>{link.txt}</Link>}
          </li>
        ))}
      </ol>
    </section>
  )
}
