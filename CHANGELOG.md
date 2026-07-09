# Changelog

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
- **Auto-expand tool outputs**: pi-distro-one's status-line extension now auto-expands
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
