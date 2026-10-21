# Review rubric

Version: 2

Used by step 2 of the Review section ("against the expected level"). Twelve axes in two
groups. Each one has three levels plus an optional "beyond senior" line, and only four
axes define it (2, 5, 10, 12).

## What the levels mean
- **Judgement visible in one person's sessions and repo.** Not a job level. Public ladders
  also weigh team scope, production ownership, mentoring, hiring, stakeholders and business
  impact. Session transcripts show little or none of those, so "senior" on this rubric
  covers about a third of what a ladder calls senior.
- **Technical axes (1–6)** are anchored to public ladders (sources at the end). Senior ≈
  Dropbox IC3, CircleCI E3, GitLab Senior. Beyond senior is staff-level behavior that a solo
  project can still show.
- **AI axes (7–12)** have no public ladder. The official Claude Code best practices are the
  floor: following them consistently is **Mid**. **Senior** needs the item past the docs
  that each axis names. Beyond senior is measured or deterministic, not just practiced.

## How to place
- Place each axis on its own. An uneven profile is expected and is the point.
- Per axis give: level, 1–2 moments from the digest as evidence, and confidence
  (high / medium / low). Confidence can't go above the axis's **Visibility**.
- Place at the level shown **consistently** in the window. A single moment above that is
  a "signal", not a placement.
- Use `mid→senior` style when the evidence sits between two levels.
- Write **not observed** when the window has no evidence. Don't fill it from the
  background file.
- **What counts as evidence: the user's own moments in the window.** These don't count:
  - A catch made by a reviewer agent. It counts toward axes 11–12 (the user set up the
    review), not toward the axis of the finding.
  - Behavior a repo rule or hook enforces (e.g. single-intent commits, the done gate).
    Writing that rule or hook is evidence for axes 10 or 12. Following it isn't evidence
    of the in-the-moment skill.
  - That the user acted on a previous review's Next item. The idea came from the review,
    so it goes in "Since last review", not in a level. How they built it can still count
    on its axis (e.g. the mechanism picked, whether they tested it).
  - A level quoted anywhere in the digest, e.g. a past review discussed in a session.
  - The user's own view in the invocation note.
- **Beyond senior** only on the axes that define it, and only when shown in **at least 2
  separate moments** in the window, each by the user. One moment is a beyond-senior signal.
- **Case against, for every beyond-senior placement.** Before keeping it, write the
  strongest case for one level lower: the best evidence for senior, and what the beyond
  line asks for that the evidence doesn't show. If that case is strong, place senior with a
  beyond-senior signal. Put a one-line case under the table for each beyond axis you keep.

---

## Technical

### 1. Technical depth & debugging
Visibility: **medium**. It shows in the questions asked and the diagnoses accepted or
rejected. The hands-on debugging is mostly Claude's.

| Level | Observable |
|---|---|
| Junior | Accepts Claude's first diagnosis. Fixes the symptom (retry, cast, suppress). |
| Mid | Asks for the root cause before the fix. Reasons about the mechanism inside one layer (render cycle, middleware order, query plan). |
| Senior | Traces causes across layers (FE ↔ API ↔ DB) **and** predicts failures before they run, on mechanisms that aren't obvious (concurrency, protocols, caching), not only a CRUD path. Rejects an explanation that doesn't fit the mechanism. |

### 2. System design
Visibility: **high**. Plans, architecture docs and design pushback are all in the
digest.

| Level | Observable |
|---|---|
| Junior | Takes the proposed structure as is. Design questions stay at the file level. |
| Mid | Adjusts an existing design when needed. Keeps separation of concerns (layers, shared contract). |
| Senior | Designs multi-component features with clear API boundaries and data shapes. Names the failure modes up front: partial failure, races, reconnects, concurrency. Knows when to refactor and when to leave it. Weighs the trade-offs of competing options. |

Beyond senior: designs that resist misuse and still stay flexible, plus build-vs-buy and
framework calls justified by long-term cost.

### 3. Code quality & testing
Visibility: **low**. This axis is craft-heavy and Claude writes most of the code. Judge
what the user asks for, catches, rejects and sets up, not the code itself.

| Level | Observable |
|---|---|
| Junior | Accepts code without asking for tests. Doesn't notice missing edge cases or error paths. |
| Mid | Expects tests with the change, at the right level of the pyramid. Spots untested edge cases and error paths. Catches readability and naming issues in Claude's output. |
| Senior | Sets the project's quality standards and builds what enforces them: what gets tested at which level, test infrastructure (helpers, fixtures, a test DB), a testing skill. Spots security gaps (secrets, auth, validation) before they're merged. |

### 4. Delivery
Visibility: **medium**. Branches, commits and roadmap ticks show it. Ops stays low until
the project deploys.

| Level | Observable |
|---|---|
| Junior | Big, mixed changes. Finishes a task without checking that it's done (tests, lint, typecheck). |
| Mid | Splits work into small, single-intent steps. Follows the done criteria. |
| Senior | Sizes and orders work so each step ships on its own. Weighs cost vs value to cut or defer scope. Plans rollout and monitoring. |

Until the project deploys, rollout and monitoring can't be shown. Place senior on the other
two items if they're consistent, and say in the evidence that the third is unobservable.

### 5. Ambiguity & decisions
Visibility: **high**. Prompts and replies to options show how the user decides.

| Level | Observable |
|---|---|
| Junior | Needs a clear spec. Defers decisions to Claude or picks without stating the trade-off. |
| Mid | Delivers well with clear requirements. Makes decisions when options are laid out, with the trade-off stated. Asks about edge cases. |
| Senior | Delivers with unclear requirements by framing the problem first. Decides with product reasoning, and matches the rigor to how reversible the call is. Records the decision where it belongs. Revisits an earlier decision when new evidence shows up, and says why. |

Beyond senior: optimizes for the whole project over the local task, across features:
reshapes scope or the roadmap when evidence shows a better path, and the call holds up
later in the window.

When the user also owns the product, some of the ambiguity is self-made. Judge the
framing, not how unclear the start was.

### 6. Written communication
Visibility: **high**. Docs, the roadmap, the glossary and commit messages are all in the
repo. Prompts are judged under the AI axes, not here.

| Level | Observable |
|---|---|
| Junior | Docs drift from the code or go missing. Messages say what changed, not why. |
| Mid | Keeps the docs and roadmap current with the change. Writes for the audience (future self, Claude, reviewer). Clear, short commits and notes, one source of truth per topic. |
| Senior | Writes design docs for readers who weren't there: the decision, its trade-offs and risks, and the options not chosen with why. |

---

## AI / context engineering

The Junior lines are the failure patterns the official docs warn about. Mid is the docs'
advice, followed consistently. Senior is the docs plus the item past them.

### 7. Prompt scoping & specs
Visibility: **high**. Every prompt is in the digest.

| Level | Observable |
|---|---|
| Junior | Vague asks ("fix it", "make it better") that need several rounds to land. |
| Mid | Writes self-contained specs: files, constraints, scope, out of scope, done criteria, how to verify. Points Claude at existing patterns. Uses an open prompt on purpose when exploring. |
| Senior | Specs that run to done unattended: a fresh session can execute one without questions (e.g. a spec in a file, or one built by having Claude interview the user first). Says what to report back and when to stop and ask. |

### 8. Planning
Visibility: **high**. Plan-mode entries, plan edits and approvals are all in the digest.

| Level | Observable |
|---|---|
| Junior | Never plans, or plans everything, typos included. Approves plans without reading them. |
| Mid | Uses plan mode for multi-file or uncertain work, and skips it when the diff fits in one sentence. Edits and redirects the plan before approving it. Checks the implementation against it. |
| Senior | Plans whose steps each carry their own check, so progress is verifiable step by step. A separate explore phase before planning on unfamiliar ground. The plan lives in a file that a review checks the work against. |

### 9. Session & context management
Visibility: **medium**. `/clear`, handoffs and session length show it. Context size is
inferred, not measured.

| Level | Observable |
|---|---|
| Junior | Kitchen-sink sessions that mix unrelated tasks. Keeps correcting the same mistake in a polluted context. |
| Mid | Clears or starts a new session between tasks. Resets after two failed corrections, with a better prompt. Keeps exploration out of the main context. Uses handoffs to carry state. |
| Senior | Structures multi-session work: sessions split by the context each needs (research, design, build, review), and handoffs carry decisions and open questions, so a fresh session works cold from them. |

### 10. Environment config
Visibility: **high**. Changes to CLAUDE.md, rules, skills, hooks and memory are in the
repo and the digest.

| Level | Observable |
|---|---|
| Junior | Repeats the same instruction in chat instead of writing it down. Or bloats CLAUDE.md. |
| Mid | Turns repeated corrections into rules or memory. Picks the right mechanism: rule (always), skill (on demand), hook (must happen every time). Keeps CLAUDE.md short and prunes what Claude already does. |
| Senior | Builds config from observed failures and tests it against them: replays the failing case to show the hook or rule now catches it. Restricts tools where it matters (e.g. read-only agents) and weighs context cost. |

Beyond senior: reusable workflow (skills, hooks, review loops) whose effect is measured,
e.g. skill trigger tests or evals, or a before/after comparison of a config change.

### 11. Delegation
Visibility: **medium**. Subagent calls show in the digest, but missed chances to delegate
are harder to see.

| Level | Observable |
|---|---|
| Junior | Never delegates, or delegates without a clear question. |
| Mid | Sends research and independent review to subagents with a scoped question. Briefs them with enough context to work cold. |
| Senior | Picks the delegation shape for the job: parallel fan-out when work splits, read-only reviewers, fork vs fresh context, model choice. Reconciles and checks what comes back instead of passing it on. |

At solo scope, a lack of parallel agents isn't a gap when the work doesn't split.

### 12. Verification & review
Visibility: **high**. Catches, pushback and requests for evidence are the strongest
signal in the digest.

| Level | Observable |
|---|---|
| Junior | Trusts "done". Plausible-but-wrong output gets through. |
| Mid | Gives Claude a check it can run before the work starts. Asks for evidence, not claims. Uses a fresh-context review on bigger changes. |
| Senior | Catches subtle mismatches with the spec that the checks miss. Triages review findings: fixes some, rejects others with a reason, instead of chasing all of them. Checks the reviewer's claims against the code. |

Beyond senior: the checks gate the work on their own, at the turn (Stop hook, `/goal`) as
well as at commit or merge (git hooks, CI), with evidence that a gate caught a real failure.

---

Sources: Dropbox Engineering Career Framework (IC1–IC5), CircleCI Engineering Competency
Matrix, GitLab Dev Career Framework, Monzo Engineering Progression Framework v4, Claude Code
best practices (code.claude.com/docs/en/best-practices) and features overview
(code.claude.com/docs/en/features-overview).

v2 (2026-10-21): raised axes 3 and 6 by one level, axis 5's beyond line, and the AI axes
(the docs' advice is now Mid), added the evidence and case-against rules. Reviews before
it were rated on v1.
