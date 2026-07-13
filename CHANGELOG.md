# Changelog

## 0.4.0 - 2026-07-13

- **Install scope: local vs global.** Every component of a distro can now be installed
  **project-locally** (default, `./.pi/`) or **globally** (`~/.pi/agent/`, opt-in). At
  deploy/pick time the agent builds a deployment plan and offers three presets
  (accept-defaults / all-global-where-safe / customize), with safety guards for dangerous
  types (settings.json, SYSTEM.md/APPEND_SYSTEM.md, AGENTS.md). Authors can suggest a
  global default per package with a `(global)` marker. `status`/`undeploy` detect where
  each component actually landed by checking both scopes; `save` captures global config
  too (marked `(global)`).
- **Offline/rate-limit awareness**: when the official catalogue can't be fetched from
  GitHub, `list`, `status`, and the selectors now say so explicitly instead of implying
  distros don't exist or were removed.
- **Official distro names in tab-completion**: the last successful catalogue listing is
  cached to `~/.pi/harnesses/.official-cache.json`, so `deploy`/`show`/`pick` completion
  offers official names, not just local ones.
- **Robustness fixes**: provenance header parsing is now field-order-independent;
  `compareVersions` handles `v` prefixes and prerelease suffixes (`1.0.0-beta < 1.0.0`);
  the `(global)` scope marker is only honored between the package ref and the description
  dash (prose mentions no longer count); an h1 heading now also terminates the
  `## pi packages` section; `status` renders object-form package entries correctly.
- **Save snapshot hygiene**: skips `.pi/loops/` runtime state, detects binary files
  instead of inlining garbage, and caps the total inlined snapshot at 256 KB (per-file
  cap unchanged; omitted files are listed by path).
- **GitHub temp clones cleaned up**: deploy/pick kickoffs now instruct the agent to
  remove the temporary clone after copying bundled files.
- **CLI polish**: extra arguments are warned about instead of silently ignored; the
  command description lists all subcommands.
- **Distro fixes**: `web-fullstack` 0.2.0 — removed the non-functional `tools` key from
  bundled settings (pi restricts tools via the `--tools` launch flag, now documented in
  the directives); `minimal` 0.1.1 — removed the empty `packages` array from bundled
  settings (merge hazard); `trip-planner` 0.3.0 — statusline now provided by
  `npm:pi-cc-status` (bundled extension removed), supi post-install aligned with
  cc-knockoff's config-file flow, description shortened to the ≤300-char limit;
  `cc-knockoff` 1.2.1 — README global-settings path corrected to
  `~/.pi/agent/settings.json`.
- **New test suite for shipped distros** (`tests/harnesses.test.ts`): validates
  frontmatter rules (name/dir match, plain semver, description length), README presence,
  and that the bundled-files manifest matches `files/` on disk in both directions.

## 0.3.0 - 2026-07-10

- **Dynamic official distros from GitHub**: official distros (`minimal`, `web-fullstack`,
  `cc-knockoff`) are no longer bundled inside the npm package. The catalogue fetches them
  dynamically from the [`msdavid/pi-distro`](https://github.com/msdavid/pi-distro) repo's
  `harnesses/` directory via the GitHub Contents API (listed cheaply, cloned on demand
  when selected). Publishing a new official distro now only requires pushing to the repo —
  no npm release needed. Selectors and `/pi-distro list` label each distro's source
  clearly: **Official**, **Local**, or **GitHub (<owner>/<repo>)**. Official distros come
  from the trusted package repo and skip the GitHub security confirmation that other-repo
  distros require. Network failures degrade gracefully (local-only catalogue).
- **`harnesses/` removed from the npm tarball**: `package.json` `files` no longer includes
  `harnesses/`. The directory remains in the repo as the GitHub source of truth.
- **`/pi-distro status` update check** now also checks official (GitHub) sources for
  updates via the cached listing, instead of only local sources.
- **Renamed `pi-distro-one` → `cc-knockoff`**: the distro formerly known as `pi-distro-one`
  is renamed `cc-knockoff` everywhere (directory, frontmatter, docs). Projects with
  `appliedHarness: pi-distro-one` provenance will show "no longer in the catalogue" —
  redeploy as `cc-knockoff` to migrate. No automatic migration is performed.

## 0.2.0 - 2026-07-08

- **`/pi-distro undeploy`**: the reverse of `deploy` — removes an applied distro from the
  current project. Agent-driven: reads the distro's directives from provenance, compares
  against the current project state (since the user may have customized things after
  deploy), and walks the user through removal category by category (packages, files,
  AGENTS.md section, extensions) — asking per component, showing files before deleting,
  never silently removing anything. Provenance removed last. Only works for full deploys.
- **`/pi-distro pick` (partial deploy)**: select which components to apply from a distro —
  packages, bundled files, settings, context — so users can combine pieces from different
  distros to build their own. Agent-driven: walks the user through each category, surfaces
  cross-component dependencies, applies only the selected components. No provenance written
  (it's a custom config) — suggests `/pi-distro save` to capture the result.
- **User-in-the-loop principle** (governing rule): the agent now has an explicit, top-level
  rule — never make a state-changing decision for the user. Before overwriting, installing,
  skipping, substituting, or resolving any conflict, the agent must surface the decision,
  present options, and wait for explicit confirmation. Stated once in the deploy kickoff, at
  the top of SKILL.md, and as a feature promise in the README.
- **`/pi-distro update` command**: reads the applied distro from provenance, fetches the
  current version (re-clones for GitHub sources), compares versions, and if a newer version
  exists — shows a preview and asks the user to confirm before re-deploying. Never silently
  applies. `/pi-distro status` now shows whether an update is available (applied vs. latest
  version comparison).
- **GitHub distro pull**: `/pi-distro show owner/repo` and `/pi-distro deploy owner/repo`
  fetch distros from any GitHub repo via shallow clone. Deploy requires explicit
  confirmation (trust gate) with a security warning.
- **Version-aware deploy**: deploy now compares the incoming distro version against the
  project's existing provenance and reports upgrade / downgrade / same-version / distro-switch
  / first-deploy, with appropriate agent guidance (downgrade and same-version require user
  confirmation).
- **Version bumping on save-update**: updating an existing distro now requires bumping the
  `version` field (patch / minor / major) — never left unchanged.
- **Semantic redundancy check**: the package-conflict check now evaluates semantic overlap
  (different tool names, similar function), not just exact name collisions. Offers
  skip / replace / keep both / cancel.
- **Auto-expand tool outputs**: cc-knockoff's status-line extension now auto-expands
  tool output on session start (the Ctrl+O effect), while keeping thinking blocks hidden.
- **Per-distro README.md**: saved distros now include a `README.md` with an extended
  human-readable description. All seed distros ship one too.
- **Deploy selector polish**: distro names are now bold in the interactive selector,
  and the redundant title field is dropped for clarity.
- **Post-deploy restart hint**: the deploy kickoff now instructs the agent to tell the
  user to restart pi after deploying (packages/extensions load at startup).
- **Documentation overhaul**: README rewritten in neovim-distro style (LazyVim/AstroNvim/
  NvChad tone), with project-level philosophy, workflows, non-coding use cases, and a
  clear experimental/security disclaimer.
- Snapshot enumerator now captures `.crew/{agents,teams,workflows}/` (pi-crew config)
  while skipping runtime state subdirs.

## 0.1.0 - 2026-07-07

- Initial release.
