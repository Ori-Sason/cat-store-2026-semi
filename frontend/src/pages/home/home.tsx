import type React from 'react'
import { useLoaderData } from 'react-router'
import { HomeCta } from '../../cmps/home/home-cta'
import { HomeHero } from '../../cmps/home/home-hero'
import { HowItWorks } from '../../cmps/home/how-it-works'
import { LabelPriceTeaser } from '../../cmps/home/label-price-teaser'
import { NewestCats } from '../../cmps/home/newest-cats'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import type { homeLoader } from './home.loader'

export const Home: React.FC = () => {
  // Both are pending promises. NewestCats and LabelPriceTeaser each resolve their own
  const { newestCats, labelStats } = useLoaderData<typeof homeLoader>()
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const firstName = loggedInUser && utilService.getFirstName(loggedInUser.fullname)

  return (
    <div className="home">
      <HomeHero firstName={firstName} />
      <NewestCats cats={newestCats} />
      <div className="bottom">
        <HowItWorks />
        <div className="bottom-row">
          <LabelPriceTeaser labelStats={labelStats} />
          <HomeCta firstName={firstName} />
        </div>
      </div>
    </div>
  )
}
