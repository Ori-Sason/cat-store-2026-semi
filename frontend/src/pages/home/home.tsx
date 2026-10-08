import type React from 'react'
import { HomeCta } from '../../cmps/home/home-cta'
import { HomeHero } from '../../cmps/home/home-hero'
import { HowItWorks } from '../../cmps/home/how-it-works'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'

export const Home: React.FC = () => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const firstName = loggedInUser && utilService.getFirstName(loggedInUser.fullname)

  return (
    <div className="home">
      <HomeHero firstName={firstName} />
      <div className="bottom">
        <HowItWorks />
        <div className="bottom-row">
          <HomeCta firstName={firstName} />
        </div>
      </div>
    </div>
  )
}
