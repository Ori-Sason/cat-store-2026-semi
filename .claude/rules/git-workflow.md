# Git Workflow

## Approval gates
- Commit, merge and push only after the user explicitly approves. Settings enforce this
  with `ask` rules: a denied prompt means "not yet", so don't retry.

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
