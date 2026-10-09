// How many cats the home page's "Newest cats" shows. The loader asks for this many and the
// skeleton draws this many cards, so the two can't drift apart
export const NEWEST_CATS_LIMIT = 4

// Login and signup from the home page return to it, so the user lands on the greeting.
// The header's Login does the same through its own redirectTo
export const HOME_LOGIN_URL = '/login?redirectTo=%2F'
export const HOME_SIGNUP_URL = '/signup?redirectTo=%2F'
