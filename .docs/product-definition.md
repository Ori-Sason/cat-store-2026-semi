# Product Definition — Cat Store

## Vision
Cat Store is a community marketplace for cats. Owners list cats with a price, labels, and
a photo. Anyone can browse and filter cats, read reviews, and chat live with others
looking at the same cat. Cat Store covers listing cats and discovering them only. The handover happens
off-platform, at one of Cat Store's pickup points.

## Target Users
- **Guest:** looking for a cat. Browses, filters, reads reviews. No account needed.
- **Owner:** registered user who lists cats and keeps them up to date.
- **Reviewer:** registered user who reviews cats. Usually also an owner.
- **Admin:** Cat Store staff. Moderates every cat and review.

## Problem
Finding a cat today means scrolling free-text classifieds. There's no consistent info, no
way to filter by age or temperament, and no signal about who's on the other side. Cat Store
makes every cat structured and searchable, and gives every owner a public track record.

## Value Proposition
- **Structured data:** same fields on every cat, so cats can be filtered and compared.
- **Trust:** public profiles show everything a user has listed and reviewed.
- **Live conversation:** each cat has its own real-time chat room.
- **Market insight:** price and availability stats by label.

## Scope Highlights

**Catalog**
- Browse cats. Filter by name, availability, and labels. Sort by name, price, or date listed.
- Cat details page. Add, edit, and delete cats.
- Labels describe the cat: e.g. Kitten, Senior, Playful, Calm, Long-hair, Good with kids.
- Each cat has a photo, given as an image URL. If the owner leaves it empty, a default photo is used.

**Accounts**
- Sign up, log in, log out. Each cat belongs to the user who created it, its owner.

**Reviews & profiles**
- Reviews on each cat's details page.
- Public user profile showing that user's cats and reviews.

**Live features**
- Per-cat chat room with a typing indicator and saved history.
- Site-wide notification when a cat or review is added, edited, or deleted.

**Insights & About**
- Dashboard: median price (with range) and % in stock, per label.
- About page with a map of pickup points.

## Permissions

| Action (cats & reviews)     | Guest | Logged-in user | Admin |
|-----------------------------|-------|----------------|-------|
| Read                        | ✅    | ✅             | ✅    |
| Add                         | ❌    | ✅             | ✅    |
| Edit / delete               | ❌    | Own only       | ✅    |

The server enforces these rules. The UI hides actions the user can't take.

## Out of Scope
- Buying, checkout, payments, or reservations.
- Private messages between users.
- Photo upload. A cat photo is a URL only.
- Password reset and email of any kind.
- A site-wide reviews page.

## Update Triggers
- Update this file when target users, product scope, permissions, or out-of-scope items change.
