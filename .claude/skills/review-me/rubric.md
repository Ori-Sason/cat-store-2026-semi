# Review rubric

Used by step 2 of the Review section ("against the expected level"). Twelve axes in two
groups. Each one has three levels plus an optional "beyond senior" line, and only four
axes define it.

## How to place
- Place each axis on its own. An uneven profile is expected and is the point.
- Per axis give: level, 1–2 moments from the digest as evidence, and confidence
  (high / medium / low). Confidence can't go above the axis's **Visibility**.
- Place at the level shown **consistently** in the window. A single moment above that is
  a "signal", not a placement.
- Use `mid→senior` style when the evidence sits between two levels.
- Write **not observed** when the window has no evidence. Don't fill it from the
  background file.
- **Beyond senior** only on the axes that define it.
- For the AI axes, the benchmark is a strong Claude Code practitioner today, not an
  average developer.

---

## Technical

### 1. Technical depth & debugging
Visibility: **medium**. It shows in the questions asked and the diagnoses accepted or
rejected. The hands-on debugging is mostly Claude's.

| Level | Observable |
|---|---|
| Junior | Accepts Claude's first diagnosis. Fixes the symptom (retry, cast, suppress). |
| Mid | Asks for the root cause before the fix. Reasons about the mechanism inside one layer (render cycle, middleware order, query plan). |
| Senior | Traces a cause across layers (FE ↔ API ↔ DB) or predicts a failure before it runs. Rejects an explanation that doesn't fit the mechanism. |

### 2. System design
Visibility: **high**. Plans, architecture docs and design pushback are all in the
digest.

| Level | Observable |
|---|---|
| Junior | Takes the proposed structure as is. Design questions stay at the file level. |
| Mid | Adjusts an existing design when needed. Keeps separation of concerns (layers, shared contract). |
| Senior | Designs multi-component features with clear API boundaries and data shapes. Knows when to refactor and when to leave it. Weighs the trade-offs of competing options. |

Beyond senior: designs that resist misuse and still stay flexible, plus build-vs-buy and
framework calls justified by long-term cost.

### 3. Code quality & testing
Visibility: **low**. This axis is craft-heavy and Claude writes most of the code. Judge
what the user asks for, catches and rejects, not the code itself.

| Level | Observable |
|---|---|
| Junior | Accepts code without asking for tests. Doesn't notice missing edge cases or error paths. |
| Mid | Expects tests with the change (happy path + failure). Catches readability and naming issues in Claude's output. |
| Senior | Asks for tests at the right level of the pyramid. Spots untested edge cases and security gaps (secrets, auth, validation) before they're merged. |

### 4. Delivery
Visibility: **medium**. Branches, commits and roadmap ticks show it. Ops stays low until
the deploy parts exist.

| Level | Observable |
|---|---|
| Junior | Big, mixed changes. Finishes a task without checking that it's done (tests, lint, typecheck). |
| Mid | Splits work into small, single-intent steps. Follows the done criteria. |
| Senior | Sizes and orders work so each step ships on its own. Weighs cost vs value to cut or defer scope. Thinks about rollout and monitoring when it applies. |

### 5. Ambiguity & decisions
Visibility: **high**. Prompts and replies to options show how the user decides.

| Level | Observable |
|---|---|
| Junior | Needs a clear spec. Defers decisions to Claude or picks without stating the trade-off. |
| Mid | Delivers well with clear requirements. Makes decisions when options are laid out. Asks about edge cases. |
| Senior | Delivers with unclear requirements by framing the problem first. Decides with a stated trade-off and product reasoning. Records the decision where it belongs. |

Beyond senior: optimizes for the whole system over the local task. Revisits an earlier
decision when new evidence shows up, and says why.

### 6. Written communication
Visibility: **high**. Docs, the roadmap, the glossary and commit messages are all in the
repo. Prompts are judged under the AI axes, not here.

| Level | Observable |
|---|---|
| Junior | Docs drift from the code or go missing. Messages say what changed, not why. |
| Mid | Keeps the docs and roadmap current with the change. Writes clear, short commits and notes. |
| Senior | Writes for the audience (future self, Claude, reviewer). Prunes docs and keeps one source of truth per topic. |

---

## AI / context engineering

### 7. Prompt scoping & specs
Visibility: **high**. Every prompt is in the digest.

| Level | Observable |
|---|---|
| Junior | Vague asks ("fix it", "make it better") that need several rounds to land. |
| Mid | Names the files, constraints and expected result. Points Claude at existing patterns. |
| Senior | Writes self-contained specs: scope, out of scope, done criteria, and how to verify. Uses an open prompt on purpose when exploring. |

### 8. Planning
Visibility: **high**. Plan-mode entries, plan edits and approvals are all in the digest.

| Level | Observable |
|---|---|
| Junior | Never plans, or plans everything, typos included. Approves plans without reading them. |
| Mid | Uses plan mode for multi-file or uncertain work. Asks questions about the plan before approving it. |
| Senior | Matches the overhead to the task: skips planning when the diff fits in one sentence. Edits and redirects the plan, and checks the implementation against it. |

### 9. Session & context management
Visibility: **medium**. `/clear`, handoffs and session length show it. Context size is
inferred, not measured.

| Level | Observable |
|---|---|
| Junior | Kitchen-sink sessions that mix unrelated tasks. Keeps correcting the same mistake in a polluted context. |
| Mid | Clears or starts a new session between tasks. Uses handoffs to carry state across. |
| Senior | Resets after two failed corrections, with a better prompt. Keeps exploration out of the main context. Handoffs carry decisions, not transcripts. |

### 10. Environment config
Visibility: **high**. Changes to CLAUDE.md, rules, skills, hooks and memory are in the
repo and the digest.

| Level | Observable |
|---|---|
| Junior | Repeats the same instruction in chat instead of writing it down. Or bloats CLAUDE.md. |
| Mid | Turns repeated corrections into rules or memory. Keeps CLAUDE.md short. |
| Senior | Picks the right mechanism: rule (always), skill (on demand), hook (must happen every time). Prunes what Claude already does without being told. |

Beyond senior: builds reusable workflow (skills, hooks, review loops) that changes how the
work gets done, and checks that the behavior actually shifted.

### 11. Delegation
Visibility: **medium**. Subagent calls show in the digest, but missed chances to delegate
are harder to see.

| Level | Observable |
|---|---|
| Junior | Never delegates, or delegates without a clear question. |
| Mid | Sends broad research to subagents with a scoped question. |
| Senior | Delegates where a fresh context pays: research, independent review, parallel work. Briefs the subagent with enough context to work cold. |

### 12. Verification & review
Visibility: **high**. Catches, pushback and requests for evidence are the strongest
signal in the digest.

| Level | Observable |
|---|---|
| Junior | Trusts "done". Plausible-but-wrong output gets through. |
| Mid | Asks Claude to run tests, lint and typecheck. Catches obvious errors in the output. |
| Senior | Gives Claude a check it can run before the work starts. Asks for evidence, not claims. Catches subtle mismatches with the spec. Uses a fresh-context review on bigger changes. |

Beyond senior: makes the checks deterministic (hooks, CI gates) so verification doesn't
depend on remembering to do it.

---

Sources: Dropbox Engineering Career Framework (IC2–IC5), CircleCI Engineering Competency
Matrix, GitLab Dev Career Framework, Claude Code best practices
(code.claude.com/docs/en/best-practices).
