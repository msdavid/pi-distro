# Contributing to pi-distro

Thanks for your interest in improving `@msdavid/pi-distro`! This is a small project
and good contributions are welcome.

## Project orientation

pi-distro is a [pi](https://pi.dev/) package that ships **TypeScript source
directly** — there is no build step. Pi loads `.ts` files via jiti at runtime, so
what you edit is what runs. Keep that in mind: don't introduce a compile step or
ship compiled output.

- `extensions/` — the `/pi-distro` command (deploy, undeploy, pick, update, save,
  list, show, status, remove) and its helpers (`catalogue.ts`, `frontmatter.ts`,
  `github.ts`).
- `skills/pi-distro/SKILL.md` — the agent-side guidance loaded on demand.
- `harnesses/` — the official distros (`minimal`, `cc-knockoff`, `web-fullstack`).
  Each is a directory with `harness.md` + `files/`. This dir is the source of truth on
  GitHub and is **not** shipped in the npm tarball (the catalogue fetches it dynamically).
- `docs/authoring.md` — the distro format reference (shipped in the package).

Please read [`AGENTS.md`](./AGENTS.md) first — it codifies the conventions this
project follows (explore before acting, surgical changes, simplicity first, file
size limits, verify-don't-guess).

## Prerequisites

- Node.js **>= 22.19.0** (matches pi's own requirement).
- npm.

## Getting started

```bash
npm install        # install dev dependencies
npm run typecheck  # type-check extensions/ and bundled harness extensions
npm test           # run the unit tests (node:test + tsx)
```

To try your changes locally inside pi:

```bash
pi install .       # install this package from the local directory
# then use /pi-distro … in a pi session
```

## Before opening a PR

1. **`npm run typecheck` passes.** This covers both `extensions/**/*.ts` and the
   bundled `harnesses/**/*.ts` (e.g. `claude-statusline.ts`) — bundled extensions
   are user-facing and must type-check too.
2. **`npm test` passes.** Add a test for any pure helper you change or add (see
   `tests/helpers.test.ts` for the style).
3. **Keep files under the size limits** in `AGENTS.md`. If `extensions/index.ts`
   is approaching the limit, split it into focused modules.
4. **Don't ship secrets, `.env`, or `node_modules/`.** The `files` allowlist in
   `package.json` controls what publishes — verify with `npm pack --dry-run`.
5. **Document changes.** Update `docs/authoring.md`, `skills/pi-distro/SKILL.md`,
   and `CHANGELOG.md` when behavior changes.

## Commit and PR style

- Small, focused PRs that address one thing.
- Clear description of what changed and why.
- Reference any issue the PR closes.

## Scope

pi-distro is deliberately small and composable. If you're considering a large or
speculative addition, please open an issue to discuss it first.
