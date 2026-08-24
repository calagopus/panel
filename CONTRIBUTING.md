# Contributing to Calagopus Panel

Thanks for taking the time to contribute. This document covers how to propose and submit changes; see [DEVELOPMENT.md](./DEVELOPMENT.md) for setting up a local environment.

## Before you start

- For small fixes (typos, obvious bugs, small refactors), just open a PR.
- For anything larger, e.g. new features, breaking changes, architectural changes, open an issue first, or bring it up in [Discord](https://discord.gg/uSM8tvTxBV). This avoids wasted work if the change doesn't fit the project's direction.
- Security vulnerabilities should **not** go through a public issue or PR; see [SECURITY.md](./SECURITY.md).

## AI / LLM usage

We do not accept PRs that are written, in whole or in part, by AI or LLM tools (e.g. ChatGPT, Claude, Copilot, Cursor, etc.). This includes generated code. Generated commit messages, and generated PR descriptions are generally fine.

- PRs found to contain AI/LLM-generated contributions will be rejected, regardless of how small the AI-generated portion is.
- You're welcome to use AI tools to help you learn or research (e.g. asking how something works), as long as the actual contribution is your own understanding and work.
- Maintainers may ask you to explain any part of your change. Being unable to explain your own PR is grounds for rejection, independent of whether AI was used.

We enforce this because reviewing unreviewed, AI-generated code costs maintainers significantly more time than reviewing code a contributor understands and stands behind, and because low-effort AI-generated PRs have become a recurring drain on open source projects.

## Making changes

- Keep PRs focused. A PR should do one thing; unrelated changes makes review harder and should be a separate PR.
- Match the existing code style in the area you're touching rather than introducing a new pattern.
- If you're touching both frontend and backend for one feature, that's fine in one PR, but avoid mixing in changes to unrelated parts of the codebase.

### Translations

Only edit `frontend/src/translations.ts` by hand, and run `pnpm build:translations` to update `en.json`. All other locale files are managed through [Crowdin](https://crowdin.com/project/calagopus) and updated by an automated PR. Don't hand-edit or add translated strings for other languages.

### Database changes

Schema changes go through a Drizzle migration in `database/`. Don't edit existing migrations that have already been merged.

## Before opening a PR

Run the same checks CI runs:

```bash
# Backend
cargo fmt
cargo clippy

# Frontend
cd frontend
pnpm biome:fix-unsafe
```

Alternatively, you can set up the git commit hook to automatically handle the frontend portion. Do this by running `git config core.hooksPath '.hooks'`.

## Commit messages & PR description

- Write commit messages in the imperative mood (`fix ...`, `add ...`, `refactor ...`), describing what the commit does.
- Fill out the PR template: what changed, why, and how you tested it. Include screenshots or a short recording for UI changes.

## Review

- A maintainer will review your PR. Expect requested changes on first pass for larger contributions.
- Keep the PR up to date with `main` if conflicts come up; prefer rebasing over merge commits for that.
