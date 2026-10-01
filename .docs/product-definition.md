# Product Definition — Cat Store

## Vision
Cat Store is a community marketplace for cats. Sellers list cats with a price, labels, and
a photo. Anyone can browse and filter listings, read reviews, and chat live with others
looking at the same cat. Cat Store covers listing and discovery only. The handover happens
off-platform, at one of Cat Store's pickup points.

## Target Users
- **Guest:** looking for a cat. Browses, filters, reads reviews. No account needed.
- **Seller:** registered user who lists cats and keeps those listings up to date.
- **Reviewer:** registered user who reviews listings. Usually also a seller.
- **Admin:** Cat Store staff. Moderates every listing and review.

## Problem
Finding a cat today means scrolling free-text classifieds. There's no consistent info, no
way to filter by age or temperament, and no signal about who's on the other side. Cat Store
makes every listing structured and searchable, and gives every seller a public track record.

## Value Proposition
- **Structured listings:** same fields on every cat, so listings can be filtered and compared.
- **Trust:** public profiles show everything a user has listed and reviewed.
- **Live conversation:** each listing has its own real-time chat room.
- **Market insight:** price and availability stats by label.

## Scope Highlights

**Catalog**
- Browse listings. Filter by name, availability, and labels. Sort by name, price, or date listed.
- Listing details page. Add, edit, and delete listings.
- Labels describe the cat: e.g. Kitten, Senior, Playful, Calm, Long-hair, Good with kids.
- Each listing has a photo, given as an image URL. If the seller leaves it empty, a default photo is used.

**Accounts**
- Sign up, log in, log out. Each listing belongs to the user who created it.

**Reviews & profiles**
- Reviews on each listing's details page.
- Public user profile showing that user's listings and reviews.

**Live features**
- Per-listing chat room with a typing indicator and saved history.
- Site-wide notification when a listing or review is added, edited, or deleted.

**Insights & About**
- Dashboard: average price and % available, per label.
- About page with a map of pickup points.

## Permissions

| Action (listings & reviews) | Guest | Logged-in user | Admin |
|-----------------------------|-------|----------------|-------|
| Read                        | ✅    | ✅             | ✅    |
| Add                         | ❌    | ✅             | ✅    |
| Edit / delete               | ❌    | Own only       | ✅    |

The server enforces these rules. The UI hides actions the user can't take.

## Out of Scope
- Buying, checkout, payments, or reservations.
- Private messages between users.
- Photo upload. A listing photo is a URL only.
- Password reset and email of any kind.
- A site-wide reviews page.

## Update Triggers
- Update this file when core user segments, product scope, or acceptance criteria change.
