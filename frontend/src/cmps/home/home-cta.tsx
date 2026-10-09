import type React from 'react'
import { Link } from 'react-router'
import { HOME_LOGIN_URL, HOME_SIGNUP_URL } from '../../models/home'

interface HomeCtaProps {
  firstName: string | null // null for a guest
}

export const HomeCta: React.FC<HomeCtaProps> = ({ firstName }) => {
  return (
    <section className="home-cta">
      {firstName ? (
        <>
          <h2>Got a cat to list, {firstName}?</h2>
          <p>Add a photo URL, labels and a price. You can edit or remove it any time.</p>
          <div className="ctas">
            <Link to="/cat/new" className="main-btn">
              + Add a cat
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2>Got a cat to list?</h2>
          <p>
            Sign up, add a photo URL, labels and a price. Your cat shows up in the list right away.
          </p>
          <div className="ctas">
            <Link to={HOME_SIGNUP_URL} className="main-btn">
              Sign up
            </Link>
            <Link to={HOME_LOGIN_URL} className="sub-btn">
              Log in
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
