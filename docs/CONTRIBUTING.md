# Contributing to TaskFlow

Thanks for your interest! TaskFlow is a small project — we keep it that way deliberately. A few guidelines.

## Setup

```bash
git clone https://github.com/physicalaff/taskflow.git
cd taskflow
npm install
npm run dev
```

Open `http://localhost:3000`.

## Workflow

1. Open an issue describing the change. For bugs, include reproduction steps. For features, describe the use case before the implementation.
2. Branch off `main`.
3. Make focused commits with imperative present-tense messages (`add tag filter to list endpoint`, not `added` or `fixing stuff`).
4. Run `npm test` and `npm run lint` locally.
5. Open a PR. Keep it small: one logical change per PR.

## Code style

- Use ES modules (`type: "module"`) and async/await.
- 2-space indentation, no tabs (enforced by `npm run lint`).
- Validate input at the route boundary, trust internal callers.
- Throw `HttpError(status, code)` for expected errors; let unexpected errors bubble.
- Keep the frontend dependency-free. If you reach for a library, ask first.

## What we won't merge

- New runtime dependencies without a strong reason.
- Authentication systems (TaskFlow is single-tenant by design; auth is a bearer token).
- Anything that requires a build step on the frontend.

## Reporting security issues

If you find a security vulnerability, please email the maintainer instead of opening a public issue.
