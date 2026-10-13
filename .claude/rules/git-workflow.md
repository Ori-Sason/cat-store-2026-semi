# Git Workflow

## Approval gates
- Commit, merge and push only after the user explicitly approves. Settings enforce this
  with `ask` rules: a denied prompt means "not yet", so don't retry.
- Ask before every single commit. Show the diff summary and the proposed message, then
  wait for an OK for that commit. Approving a plan like "one commit per test" is not
  approval to make those commits.

## Before a merge to main or a push
Suggest the ones that apply. Don't run them on your own: the user decides, and may skip one
for a reason (e.g. a handoff stays for now).
- A fresh-context review of the whole branch, when it has real code changes.
- `npm run test:e2e`, before a local merge. The pre-push hook already runs it on a push.
- If the branch's handoffs are done: move any decision a later session could reverse to where
  it will be in context when it matters (e.g. a code comment, a doc, a rule, a skill, CLAUDE.md).
  Check it isn't already there first. Then the user can delete them.

## Branches
- Do implementation work on a dedicated branch, never on `main`.
- Create the branch before executing an approved plan.
- One plan or workstream per branch.
- Lowercase `<type>/<topic>`, using the same types as commits: `feat/sign-up-page`,
  `fix/cat-not-found`, `chore/root-oxfmt`.

## Commits
- [Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>): <summary>`.
  - `type`: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.
  - `scope`: `fe`, `be` or `shared`. Omit it when the change spans packages.
  - `summary`: imperative, lowercase, no period: `feat(fe): add sign-up page`.
- One intent per commit. Keep commits small so the history shows step-by-step progress.
  Don't bundle unrelated changes.
- Roadmap status updates for a feature go in that feature's commit, not a separate
  `docs:` commit. They record that the feature landed, so they're the same intent.

## The index
- The index is the user's review marker: staged = reviewed. Don't stage, unstage or reset
  until the user says to commit; then stage everything that belongs to the commit.
