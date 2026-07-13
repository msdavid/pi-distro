---
name: pi-distro
description: "Manages pi distros — reusable, composable project configurations. Use when deploying a distro (/pi-distro deploy), saving the current project config as a distro (/pi-distro save), listing/showing/removing distros, or checking distro status. Triggers on: distro, save my config, deploy a distro, set up a distro."
---

# pi-distro Skill

This skill guides the agent through the interactive phases of the pi-distro
extension: deploying a distro (`/pi-distro deploy`) and saving a live project
configuration as a distro (`/pi-distro save`). The extension command handles
catalogue reading, UI selectors, and kickoff-message injection; this skill provides
the agent-side guidance for those non-deterministic, collaborative flows.

## Governing principle: the user is in the loop for every decision

pi-distro is a **collaborative, agent-driven** tool. The agent never makes a
state-changing decision for the user. Before overwriting a file, installing a
package, skipping a step, replacing a tool, applying an upgrade, or resolving any
conflict (merge, redundancy, version downgrade, same-version, etc.), the agent
must:

1. **Surface** the decision clearly — what it's about to do, and why.
2. **Present** the available options (skip / replace / keep theirs / keep both /
   cancel, as applicable).
3. **Wait** for the user's explicit choice. Never proceed on assumption.

Never silently skip, silently overwrite, silently substitute, or silently choose.
If a decision is ambiguous or the user is unsure, explain the tradeoffs and let
them choose. **The agent proposes; the user disposes.** Every other rule in this
skill (merge-don't-clobber, package-redundancy, version-aware deploy, the GitHub
trust gate, the scope rule) is a specific instance of this principle.

## Scope model: local vs global

pi supports two install scopes, and pi-distro lets the user choose per component:

- **Project-local** (default) — writes to `./.pi/` (packages via `pi install -l` →
  `./.pi/settings.json`; extensions/skills/prompts/themes into `./.pi/<type>/`; settings into
  `./.pi/settings.json`; AGENTS.md at `./AGENTS.md`). Scoped to this project only. This is the
  default philosophy — different projects get different harnesses.
- **Global** — writes to `~/.pi/agent/` (packages via `pi install` →
  `~/.pi/agent/settings.json`; extensions/skills/prompts/themes into `~/.pi/agent/<type>/`;
  settings into `~/.pi/agent/settings.json`; AGENTS.md at `~/.pi/agent/AGENTS.md`). Shared
  across **every project and session on this machine**. Opt-in, never the default.

pi merges global and project-local (project-local shadows global on conflict).

### Per-type default scopes

| Component type | Default scope | Global allowed? |
|---|---|---|
| Packages | local | ✅ |
| Extensions | local | ✅ |
| Skills | local | ✅ |
| Prompts | local | ✅ |
| Themes | **global** | ✅ |
| settings.json merge | local | ⚠️ guarded (explicit confirm) |
| SYSTEM.md / APPEND_SYSTEM.md | local | ⚠️ double-confirm |
| AGENTS.md | local | ⚠️ guarded (explicit confirm) |

### Deployment-plan procedure

At the start of a `deploy` (and for the selected items in a `pick`), the kickoff includes a
**scope rule** with this procedure. Follow it exactly:

1. **Build a deployment plan** grouping every installable component by type, each with its
   default scope (per the table above, or the author's `(global)` hint if the directives
   mark one). Render it as markdown so the user sees the whole picture.
2. **Offer three presets** via `ctx.ui.select`:
   - **(a) Accept defaults** — keep every component at its default scope. Recommended.
   - **(b) All-global (where safe)** — flip every global-allowed component to global;
     dangerous types (settings, SYSTEM.md, AGENTS.md) stay local with a surfaced warning.
   - **(c) Customize** — walk items one at a time, offering `local` / `global` / `skip`
     each (`ctx.ui.select` is single-select). Cancel on an item = skip that item.
3. **Scope-safety guard** — when a dangerous type's final scope is global, surface the blast
   radius ("affects every project/session on this machine") and require explicit confirm.
   For SYSTEM.md/APPEND_SYSTEM.md global, require a second confirm.
4. **Install/place at the chosen scope** — `pi install -l` (local) or `pi install` (global)
   for packages; write files to `./.pi/...` (local) or `~/.pi/agent/...` (global).
5. **Provenance does not record scope.** At `undeploy`/`status` time, the extension detects
   placement by checking both locations (`./.pi/...` and `~/.pi/agent/...`, plus `pi list`).
   So note in your final report which components went global, so the user knows where to find
   and remove them.

## `/pi-distro deploy` — Distro Deployment

When you receive a kickoff message from the `deploy` command, it contains:

- The full `harness.md` body (directives) for the selected distro.
- A manifest of bundled files (source path → target path) and the absolute path of
  the distro `files/` directory on disk.
- The merge-don't-clobber rule.
- An instruction to write/update provenance.

The distro may come from the local catalogue (official, fetched from GitHub, or
user-saved) or directly from another GitHub repo
(`/pi-distro deploy owner/repo`). For GitHub distros, the extension has already
cloned the repo, displayed a security warning + preview, and obtained the user's
explicit confirmation before sending the kickoff — so you can proceed normally.
The provenance `sourceCatalogue` will be `github:owner/repo[/subpath]`.
Bundled files for GitHub distros are located in a temp directory (`/tmp/`) — copy
them from there as usual, then **remove the temporary clone** (the kickoff names the
exact `rm -rf` target) so repeated GitHub deploys don't accumulate clones in `/tmp`.

### Deployment steps

1. **Read the directives.** The `harness.md` body tells you what to set up — bundled
   files, pi packages to install, hooks/extensions to create, context to write, and
   skills/prompts to configure. Follow those directives.

2. **Deploy bundled files with merge-don't-clobber.** For every bundled file in the
   manifest that maps to a target path in the project:

   - If the target file does **not** exist, copy it verbatim from the distro `files/`
     directory.
   - If the target file **already exists**, do **NOT** overwrite it silently. Instead:
     - Read both the existing file and the bundled source.
     - Show the user a diff (or summary of differences).
     - Ask the user whether to **overwrite**, **keep theirs**, or **merge**.
   - For **JSON files** (e.g. `settings.json`): if the user chooses merge, merge
     field-by-field — combine keys from both objects, with the bundled values applied
     on top but respecting existing user customisations where the user prefers to keep
     them. Never silently destroy a key the user added.
   - For **AGENTS.md**: never replace. Append the bundled content under a clearly
     delimited section, e.g.:

     ```markdown
     <!-- pi-distro: <distro-name> -->
     ...bundled AGENTS.md content...
     <!-- /pi-distro: <distro-name> -->
     ```

     If the section already exists (re-deploy), replace only that delimited section.

3. **Install pi packages — scope + redundancy/conflict detection.** If the directives
   list pi packages to install, first run the **scope** flow (deployment-plan + preset from
   the Scope model above) to decide local vs global per package, then run the
   **redundancy/conflict** check, then install at the chosen scope — `pi install -l <package>`
   for **project-local** or `pi install <package>` for **global** — but **only after
   confirming with the user** AND after evaluating tool redundancy/conflicts:

   **Do NOT pre-add packages to `settings.json` by hand.** `pi install -l` (local) and
   `pi install` (global) are the single mechanisms that register a package: each installs the
   package AND appends the source to the corresponding settings file (`./.pi/settings.json` or
   `~/.pi/agent/settings.json`) on success. If an install fails, nothing is added to settings
   — so settings never contains a package that isn't actually installed. (This is why the
   bundled `settings.json` does not list packages — they are registered by `pi install`, not
   by merging a `packages` array.)

   **Redundancy/conflict evaluation (do this BEFORE installing each package):** Some packages
   may provide tools that overlap with already-active tools. This can be:
   - An **exact name collision** — two tools with the same name. pi handles these by load
     order (project-local tools shadow global ones; the conflict is a **non-fatal diagnostic**,
     not a fatal error — pi still starts, but the shadowed tool is unavailable).
   - **Semantic redundancy** — different tool names, but doing very similar things (e.g. two
     web-search tools, two browser-automation tools, two todo-list tools). These both load,
     leaving the user with duplicate capability and a confusing tool set.
   You (the agent) must **evaluate** this — it requires judgment, not just string matching.
   Before installing each package:
   1. Read the **already-active tools**, **project packages**, and **global packages** from
      the kickoff's "Current project state" section, and run `pi list` for a fresh view of
      both local and global packages.
   2. For each to-be-installed package, compare its stated purpose (from the directives)
      against the already-active tools. Ask: *does this package do something an existing tool
      already does?* Consider both exact name matches and semantic overlap.
   3. If redundancy or a conflict is detected, do **NOT** install blindly — present the user
      a choice and explain the overlap:
      - **(a) Skip** — the capability already exists; don't install the package. Note this
        in the provenance/deployment report.
      - **(b) Replace** — remove the overlapping package from wherever it lives
        (`pi remove -l <overlapping-package>` if project-local, `pi remove <pkg>` if global),
        then install the new one at the chosen scope (`pi install -l <new-package>` for local
        or `pi install <new-package>` for global).
      - **(c) Keep both** — install it anyway. Use this when the user prefers the new tool,
        or when the two tools serve subtly different purposes despite surface similarity.
      - **(d) Cancel** — don't install anything.
   4. Only proceed with the user's chosen option.

4. **Create hooks / extensions / prompts / skills / themes.** If the directives instruct creating
   these, place them at the **chosen scope**: `./.pi/<type>/` (local) or `~/.pi/agent/<type>/`
   (global) — themes default to global. Create them using the bundled source files or the
   directives' instructions. Apply the same merge-don't-clobber rule (at whichever target
   path) for any that already exist.

5. **Write/update provenance.** When the deployment is complete, write (or update)
   `./.pi/harness.md` in the project directory. The provenance file is itself a valid
   `harness.md` (the applied distro's frontmatter + directives) with a provenance
   header injected at the top of the body:

   ```markdown
   <!-- pi-distro provenance
        appliedHarness: <name>
        appliedVersion: <version>
        sourceCatalogue: <user|github:owner/repo[/subpath]>
        lastUpdated: <ISO8601>
   -->
   ```

   - `appliedHarness`: the name of the distro that was deployed.
   - `appliedVersion`: the version from the distro frontmatter.
   - `sourceCatalogue`: `user` if from `~/.pi/harnesses/`, or
     `github:owner/repo[/subpath]` (official distros are `github:msdavid/pi-distro/harnesses/<name>`).
   - `lastUpdated`: current timestamp in ISO 8601 format.

6. **Report.** Summarise what was deployed, merged, skipped, and any packages installed.
   Mention that the user can run `/pi-distro status` to see the current configuration.

7. **Recommend a restart.** Tell the user to **restart pi** — newly installed packages and
   extensions are loaded at startup and are not available until the next session. The
   configuration changes (settings, context, skills) take effect immediately, but code
   that runs at startup (extensions, package-provided tools) requires a restart.

### Version-aware deploy

The kickoff message includes a **Version note** section that compares the incoming distro
version against the project's existing provenance (`appliedVersion` in `./.pi/harness.md`).
Follow it:
- **Upgrade** (incoming > existing): proceed normally with merge-don't-clobber. Existing
  user customisations should be preserved — the new version adds/changes, it doesn't wipe.
- **Downgrade** (incoming < existing): **ask the user to confirm** before proceeding — this
  may remove features or regress fixes. Only proceed if they confirm.
- **Same version** (incoming == existing): **ask the user** whether to (a) skip (no changes
  — the project already has this exact distro) or (b) force re-deploy (re-run the merge,
  useful if files were manually edited or the distro was updated in-place without a version
  bump). Only proceed if they choose (b).
- **Different distro** (existing `appliedHarness` != incoming name): treat as a distro
  switch — do not assume the new distro's files are a superset of the old. Merge with
  existing config; the user may want to clean up files the old distro added.
- **First deploy** (no existing provenance): proceed normally.

## `/pi-distro update` — Update Applied Distro

When you receive a kickoff from the `update` command, the extension has already:

1. Read the project's provenance (`appliedHarness`, `appliedVersion`, `sourceCatalogue`).
2. Resolved the *current* version of that distro from the catalogue (or re-cloned the
   GitHub repo if `sourceCatalogue` starts with `github:`).
3. Compared versions.
4. If a newer version exists: displayed a preview to the user and obtained their explicit
   confirmation before sending the kickoff.

So by the time you (the agent) receive the kickoff, the user has already confirmed they
want the update. Proceed exactly as a normal deploy (merge-don't-clobber, user-involvement
rule, package-redundancy check, version note — which will show as an "upgrade"). The
update is just a re-deploy of the same distro at a newer version, with the user's consent
already obtained.

If the extension did NOT send a kickoff (e.g. "already up to date" or "downgrade
warning"), there is nothing for you to do — those cases are handled entirely by the
extension with a notification.

## `/pi-distro pick` — Partial Deploy

When you receive a kickoff from the `pick` command, the user wants to **select which
components to apply** from a distro — not the whole thing. This lets them combine pieces
from different distros to build their own configuration.

The kickoff lists the distro's components grouped by category (packages, bundled files,
and any other components described in the directives) along with the full directives for
your reference. Follow the selection procedure in the kickoff exactly:

1. **Walk the user through each category, one at a time.** Use `ctx.ui.select`/`ctx.ui.confirm`
   to let them pick which items to apply. Present each item with its one-line purpose (from
   the directives) and its author scope hint (`[local]`/`[global]`). Let them select any
   subset — including none (skip the category).
2. **Surface dependencies.** As the user selects, evaluate cross-component dependencies and
   warn about them before applying. Example: if they pick an extension that references a
   theme provided by a package they skipped, point that out and ask whether to also install
   the package or skip the extension. Reason about the dependencies from the directives
   prose — this is a judgment task. Never silently install a dependency the user didn't pick.
3. **Choose scope (local vs global).** For the selected components, run the deployment-plan
   + preset flow from the Scope model above (accept-defaults / all-global-where-safe /
   customize). The plan is built from only the selected components. Apply the scope-safety
   guard for dangerous types.
4. **Apply only the selected components** at the chosen scope with the same rules as a full
   deploy: merge-don't-clobber (at whichever target path), package-redundancy check,
   `pi install -l` (local) or `pi install` (global) for packages (after confirming),
   copy/merge for files (overwrite / keep theirs / merge).
5. **Do NOT write standard provenance.** A partial deploy is a custom config, not "this
   distro was applied." Do not write `appliedHarness`/`appliedVersion` provenance. Instead,
   after applying, suggest the next step: "This is a custom configuration. Run
   `/pi-distro save` to snapshot it as your own reusable distro" (which writes clean
   provenance for the saved distro).
6. **Recommend a restart** if any packages or extensions were installed.

The natural loop is: `/pi-distro pick <distro-A>` → `/pi-distro pick <distro-B>` →
`/pi-distro save` (snapshot the combined result as a new distro). This is how users build
their own distro from pieces of others.

## `/pi-distro undeploy` — Remove Applied Distro

When you receive a kickoff from the `undeploy` command, the user wants to **remove** the
applied distro from the project — the reverse of `deploy`. The extension has already read
provenance and sent you the distro's directives plus the current project state (which of
the distro's packages are still installed, whether the `AGENTS.md` delimited section
exists, what's in `.pi/settings.json`).

**Critical context:** provenance records the distro's *intentions* (the directives), not
the exact outcome of the interactive deploy. The user may have skipped packages during
deploy, customized files afterward, or removed things manually. So you must compare the
directives against the *current* project state and let the user decide what to remove.

Follow the removal procedure in the kickoff exactly:

1. **Walk the user through each removal category, one at a time.** A distro may have
   placed components at EITHER scope — the kickoff reports each package's placement
   (`[local]`, `[global]`, `[both]`) by checking both `./.pi/...` and `~/.pi/agent/...`, plus
   `pi list`. Remove from wherever it actually lives:
   - **(a) Packages** — for each distro package still installed, remove it from where it
     lives: `pi remove -l <pkg>` for `[local]`, `pi remove <pkg>` for `[global]` (warn: global
     removal affects EVERY project on this machine — get explicit confirm), and BOTH
     commands for `[both]`. Ask per package — the user may want to keep some. Warn if
     removing a package that other components depend on.
   - **(b) Bundled files** — for each file the distro placed, check for it at BOTH
     `./<path>` (local) and `~/.pi/agent/<equivalent>` (global). If it exists, **show the
     user the file (or a summary) before removing** — they may have customized it. Offer:
     remove / keep, per location. Never silently delete. For `settings.json` (local at
     `./.pi/settings.json`, global at `~/.pi/agent/settings.json`), offer to remove specific
     keys the distro merged, not the whole file. Warn that global settings removal affects
     every project.
   - **(c) AGENTS.md delimited section** — the `<!-- pi-distro: <name> -->` ...
     `<!-- /pi-distro: <name> -->` block may exist at `./AGENTS.md` (local) and/or
     `~/.pi/agent/AGENTS.md` (global). Offer to remove it from each location it was found.
     Warn that removing the global one affects every session. Leave any non-distro content.
   - **(d) Extensions / skills / prompts / themes** — if described in the directives, check
     for them in BOTH `./.pi/<type>/` (local) and `~/.pi/agent/<type>/` (global). Offer to
     remove each (show before delete), per location.
2. **Remove provenance last** — only after the user confirms the component removals, remove
   `./.pi/harness.md`. Confirm before deleting.
3. **Report and recommend a restart** — summarise what was removed vs. kept. Tell the user to
   restart pi so removed packages/extensions fully unload.

Removal is destructive — the user-involvement rule applies doubly here. Never silently
skip, delete, or strip. The user decides; you execute their choices.

> **Note:** `undeploy` only works for full deploys (which write provenance). A partial
> deploy via `pick` doesn't write provenance — there's nothing to undeploy as a unit.

## `/pi-distro save` — Distro Authoring

When you receive a draft request from the `save` command, it contains a live-config
snapshot of the current project: the system prompt options (tools, skills, context
files, guidelines), the raw contents of **every project-local config file** found
under `./` (root `AGENTS.md`/`CLAUDE.md` variants), `./.pi/` (recursively — `settings.json`,
`SYSTEM.md`, `APPEND_SYSTEM.md`, `extensions/`, `skills/`, `prompts/`, `themes/`, and any
per-extension/skill config files like `.pi/<name>.json`), `./.crew/{agents,teams,workflows}/`
(pi-crew project-local authored definitions — NOT the runtime state subdirs), and
`./.agents/skills/` (project root only). **It also captures global (user-level) config**
from `~/.pi/agent/` (`settings.json`, `AGENTS.md`, `extensions/`, `themes/`, `skills/`,
`prompts/`) and globally-installed packages — these are marked `(global)` in the snapshot so
you can reproduce them at the global scope in the saved distro. Data/runtime dirs and the
provenance file `./.pi/harness.md` are excluded. Ancestor (parent-dir) `AGENTS.md` /
`.agents/skills/` appear only in the context-files list as informational — they are out of
scope and must NOT be bundled.

### Authoring steps

1. **Analyse the snapshot.** Review the live tools, skills, context files, installed
   packages, and raw config files to understand what makes this project's configuration
   unique and reproducible.

2. **Draft a `harness.md`.** Write a distro that reproduces this configuration:
   - **Frontmatter**: propose a `name` (slug: lowercase a-z/0-9/hyphens, no
     leading/trailing/consecutive hyphens, matching what the distro directory will be
     named), a `title` (human-readable), a `description` (one-liner, ≤300 chars), and a
     `version` (semver). Optionally `author` and `tags`.
   - **Directives body**: include sections for bundled files, pi packages to install,
     hooks/extensions, context, and skills/prompts — mirroring the live config.
   - **Scope (local vs global)**: the snapshot separates **project-local** from **global**
     (marked `(global)`, captured from `~/.pi/agent/`). Reproduce each component at the scope
     it was captured at:
     - A **global package** → list it in `## pi packages to install` with the `(global)`
       marker suffix. A **project-local package** → no marker (default local).
     - A **global bundled file** → copy into `files/` as usual, AND add a `## Global
       deployment notes` section listing which file targets should be placed globally
       (e.g. `.pi/extensions/foo.ts` → deploy globally to `~/.pi/agent/extensions/foo.ts`).
     - Global `settings.json` / `SYSTEM.md` / `AGENTS.md` → note in `## Global deployment
       notes` that they target `~/.pi/agent/...`, so the deploy-time scope-safety guard
       surfaces the blast radius.
     The user's deploy-time preset still governs the final scope — these markers/notes are
     the author-suggested defaults.

3. **Propose & confirm.** Present the proposed `name`, `title`, `description`, and the full
   draft to the user. Ask for confirmation or edits. Do not proceed until the user
   confirms.

4. **Save to the catalogue (you perform this, not the extension).** Follow the procedure in
   the kickoff message exactly:
   - Ask the user whether to **save as a new distro** or **update an existing distro**.
   - If **save as new**: validate the slug; warn on collisions with existing user
     distros or official distro names (fetched from GitHub) and ask whether to overwrite.
   - If **update existing**: let the user pick from the existing user distros listed in
     the kickoff. Refuse to update names not in that list (official/GitHub distros are
     read-only locally). Back the old distro up to `~/.pi/harnesses/.trash/<name>-<timestamp>/` before
     overwriting. **Bump the version**: read the old distro's `version` and increment it
     with semver — **patch** for small tweaks/bug fixes, **minor** for new capabilities or
     config additions, **major** for breaking changes (removed packages, changed
     conventions). Never keep the same version when updating. Propose the bumped version to
     the user and let them confirm or adjust.
   - Write `~/.pi/harnesses/<name>/harness.md` with the confirmed frontmatter + directives.
   - Copy the project's config files into `~/.pi/harnesses/<name>/files/` preserving
     their path relative to the project root — root context (`AGENTS.md`/`CLAUDE.md`),
     `.pi/settings.json`, `.pi/SYSTEM.md` & `.pi/APPEND_SYSTEM.md`, `.pi/extensions/**`
     (incl. subdir extensions), `.pi/skills/**`, `.pi/prompts/**`, `.pi/themes/**`,
     `.agents/skills/**`, `.crew/{agents,teams,workflows}/**` (pi-crew project-local authored
     definitions only), and any per-extension/skill config files (e.g. `.pi/<name>.json`)
     listed in the snapshot. Use `cp -r` for trees. Do NOT copy `./.pi/harness.md`
     (provenance) or the data/runtime dirs (`npm/`, `git/`, `sessions/`, `state/`, `tmp/`,
     the non-config subdirs of `.crew/` i.e. state/artifacts/worktrees/imports/audit/cache/graphs,
     `node_modules/`).
   - **Theme dedup:** before bundling a `.pi/themes/<name>.json`, check `pi list` for a
     package that already provides that theme (package themes surface at
     `~/.pi/agent/themes/`). If one does, do NOT bundle it — reference it via the package
     install directive instead (a bundled copy collides on deploy, like pi-crew's
     `crew-*` themes). Bundle only genuinely custom themes.
   - **pi-crew agents/teams/workflows dedup:** a `.crew/agents/foo.md` (or one under
     `.pi/teams/agents/`, `.pi/agents/`) may be a `--copy-builtins` copy of a pi-crew
     shipped builtin, not custom-authored. Compare against pi-crew's package builtins
     (`<pkg>/agents/`, `teams/`, `workflows/`); if a file is an unmodified builtin copy,
     do NOT bundle it (the `pi-crew` install directive already provides it). Bundle only
     genuinely custom/authored definitions.
   - **Write a README.md:** also write `~/.pi/harnesses/<name>/README.md` — a human-readable
     description of the distro (a few paragraphs: what it sets up, which packages it
     installs and why, what workflow it targets, and any prerequisites). This complements
     the one-liner `description` in the frontmatter. The README lives only in the
     catalogue — it is not copied into the target project on deploy.

5. **Update provenance.** Update `./.pi/harness.md` in the project to reflect the saved
   distro (the saved frontmatter + directives with the provenance header at the top of
   the body — see "Provenance file format" below).

6. **Report.** Tell the user: "Saved distro '<name>'. Run `/pi-distro deploy` elsewhere to
   deploy it."

### Authoring conventions

See `docs/authoring.md` (shipped with the `@msdavid/pi-distro` package) for the
complete distro format reference: frontmatter fields, bundled `files/` directory
conventions, directive section types, and merge-don't-clobber expectations.

## Provenance file format

The provenance file at `./.pi/harness.md` is a living record of which distro was
applied to the project. It is a valid `harness.md` (same frontmatter + directives as
the applied distro) with the provenance header comment at the top of the body. The
extension updates it automatically as a side-effect of `deploy`, `save`, and `undeploy`
commands.

When `/pi-distro save` snapshots a project, the provenance file is regenerated to
reflect the *current* live config — it becomes the record of "this project's distro
now".
