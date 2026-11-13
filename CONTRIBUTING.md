# Contributing

Thanks for helping! Every change lands through a pull request and needs the
maintainer's approval before it can merge into `main`.

## Branch and commit conventions

A branch must be named with one of these prefixes:

- `feat/…` — a new feature
- `fix/…` — a bug fix
- `test/…` — tests only
- `chore/…` — tooling, deps, docs, housekeeping

Every commit message (and your PR title) must start the same way, with `:`
instead of `/`, then a space and a short summary. An optional `(scope)` is
allowed:

```
feat: add a spectator mode
fix(monopoly): stop the jail roll ending the turn
test: cover the auction edge cases
chore: bump vite to 8.4
```

These are enforced two ways:

1. **Locally** — `npm install` points git at `.githooks/`, which rejects a bad
   commit message or a bad branch name before they leave your machine. (To
   enable by hand: `git config core.hooksPath .githooks`.)
2. **In CI** — the **PR conventions** check validates the branch name, the PR
   title and every commit in the PR. It must pass before a PR can merge.

## Before you open a PR

```bash
npm test
npm run build      # also typechecks
```

Keep a PR to one concern. For a bug, add a failing test first, then the fix.

See the README for architecture, code structure and how to add a new game.
