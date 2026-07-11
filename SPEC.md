# pi-distro — Specification

> **Note:** This is the original design specification. It documents the intent behind
> pi-distro but may lag the implementation as the project evolves. For the current,
> authoritative reference see `README.md`, `CHANGELOG.md`, `skills/pi-distro/SKILL.md`,
> and `docs/authoring.md`. Command names and version numbers below reflect the design at
> the time of writing and may be out of date.

A pi package that provides a **catalogue of distros**: named, reusable, composable
configurations of pi (skills, extensions, context, hooks/scripts, prompts, settings).
Users deploy a distro into a project from inside an interactive pi session, collaborate
with the agent to merge it into any existing configuration, and can snapshot a live
project's configuration back into the catalogue as a new or updated harness.

---

## 1. Distribution & install (Mechanism 3 — gallery-native)

- Published as the npm package **`@msdavid/pi-distro`**.
- Carries the `pi-package` keyword so it auto-indexes on the [pi.dev gallery](https://pi.dev/packages).
- Users install with a single command:
  ```bash
  pi install npm:@msdavid/pi-distro
  ```
- **No standalone shell binary.** There is no `pi-distro` CLI on PATH. All
  interaction happens through a pi slash command inside an interactive pi session.
- pi core packages are declared as `peerDependencies` with `"*"` range:
  `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`,
  `@earendil-works/pi-tui`, `typebox`.

---

## 2. Package structure

```
@msdavid/pi-distro/
├── package.json                # npm + pi manifest (pi-package keyword, pi.skills/extensions)
├── tsconfig.json               # type checking only (pi loads .ts via jiti — no build step)
├── README.md                   # user-facing docs
├── docs/
│   └── authoring.md            # how to author a distro
├── extensions/
│   └── index.ts                # the /pi-distro command dispatcher (the engine)
├── skills/
│   └── pi-distro/
│       └── SKILL.md            # the pi-distro skill (name: pi-distro)
└── harnesses/                  # official distros (source of truth on GitHub; NOT shipped in the npm tarball)
    ├── minimal/
    │   ├── harness.md
    │   └── files/              # bundled files deployed into a target project
    └── web-fullstack/
        ├── harness.md
        └── files/
```

### package.json (key fields)

```jsonc
{
  "name": "@msdavid/pi-distro",
  "version": "0.2.0",
  "type": "module",
  "license": "MIT",
  "keywords": ["pi-package"],
  "files": ["extensions", "skills", "distros", "README.md", "docs", "LICENSE"],
  "publishConfig": { "access": "public" },
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"]
  },
  "peerDependencies": {
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-agent-core": "*",
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  },
  "devDependencies": {
    "@earendil-works/pi-ai": "^0.80.0",
    "@earendil-works/pi-coding-agent": "^0.80.0",
    "@earendil-works/pi-tui": "^0.80.0",
    "typebox": "^1.1.24",
    "typescript": "^5.0.0"
  }
}
```

> No `bin`. The package contributes resources (an extension + a skill), not executables.
> Official distros live under `harnesses/` in the repo, which is the **source of truth on
> GitHub** (`msdavid/pi-distro`). They are **not** shipped in the npm tarball (the `files`
> array in `package.json` omits `harnesses/`) — the catalogue fetches them dynamically via
> the GitHub Contents API and clones on demand.

---

## 3. Distro format

A distro is a directory containing a `harness.md` plus optional bundled files.

### Directory layout of one distro

```
<name>/
├── harness.md                  # REQUIRED: frontmatter + directives
├── README.md                   # RECOMMENDED: extended human-readable description
└── files/                      # OPTIONAL: bundled files copied verbatim into the target
    ├── AGENTS.md
    ├── settings.json           # becomes ./.pi/settings.json (merged, not overwritten)
    ├── .pi/
    │   ├── extensions/
    │   │   └── hooks.ts        # "hooks" are just extensions
    │   ├── prompts/
    │   │   └── review.md
    │   └── skills/
    │       └── …/SKILL.md
    └── …
```

The `README.md` is a human-readable description of the distro (a few paragraphs:
what it sets up, which packages, what workflow, prerequisites). It complements the
frontmatter `description` (one-liner ≤300 chars). It is not consumed by the extension
and is not deployed into the target project — it lives only in the catalogue. Written
automatically by `/pi-distro save`; include one when authoring by hand.

### harness.md frontmatter (YAML between `---` fences)

```yaml
---
name: full-stack-web          # REQUIRED: unique slug; MUST match the directory name
title: Full-Stack Web         # REQUIRED: human-readable title (shown in selector)
description: >                # REQUIRED: one-liner shown in the selector (<=300 chars)
  React/Node project with web-research + review skills and sensible defaults.
version: 1.0.0               # REQUIRED: semver
author: optional             # optional
tags: [web, react]           # optional
---
```

### harness.md body (directives)

The body is **agent-readable prose** instructing the agent how to set up the directory.
There is **no deterministic/agent split** (decision C4): the whole deployment is one
agent-driven, collaborative flow. The body MAY include structured sections the agent
follows:

```markdown
# <title>

## Bundled files
The following bundled files are provided under `files/` and should be placed into the
target project. For any path that already exists, do NOT overwrite — show the user a diff
and ask whether to overwrite, keep theirs, or merge. Merge JSON settings objects field by
field. Append (not replace) `AGENTS.md` content under a clearly-delimited section.

- `files/AGENTS.md` → `./AGENTS.md`
- `files/settings.json` → `./.pi/settings.json`  (merge with existing settings)

## pi packages to install
Use `pi install -l` to install the following **project-locally** (writes to `./.pi/settings.json`
on success, leaves settings untouched on failure). Confirm with the user before each install.
Do NOT pre-add these to the bundled `settings.json` `packages` array — `pi install -l` is the
single registration mechanism (so a failed install never leaves a dangling settings entry).
- `npm:pi-browse` — for web search and content extraction
- `npm:@foo/bar` — for X

## Hooks
Create `./.pi/extensions/hooks.ts` that calls `pi.on("tool_call", …)` to …

## Context
Write `./AGENTS.md` context for …

## Skills / prompts
…
```

### Bundled files (decision B2 — yes)
Distros carry real bundled files under `files/` that get deployed into the target.
This makes a distro self-contained and reproducible elsewhere. Files that already exist
in the target are **never silently overwritten** — the agent collaborates with the user to
merge (decision: merge-don't-clobber).

### Composition (decision B3 — mutation + re-save only)
There is **no `extends:` inheritance** in v1. Composition happens by deploying a distro,
mutating the live config, and re-saving as a new distro or updating an existing one via
`/pi-distro save`. (`extends:` may be added in a future version.)

---

## 4. Catalogue

- **Global only** (decision E2): user distros live at `~/.pi/harnesses/<name>/`.
- **Official distros** (decision E4 — dynamic from GitHub): official distros live in the
  `harnesses/` directory of the [`msdavid/pi-distro`](https://github.com/msdavid/pi-distro)
  repo. They are **fetched dynamically** — the catalogue is listed via the GitHub Contents
  API (one call) + a raw frontmatter fetch per distro, and the selected distro is cloned on
  demand via `fetchGithubDistro`. They are **not** shipped in the npm package, so new
  official distros ship by pushing to the repo (no npm release required). Results are
  cached in-memory for ~5 minutes.
- **Effective catalogue** = official distros (from GitHub) ∪ user distros (from
  `~/.pi/harnesses/`). On a name collision, the **user distro takes precedence** (so users
  can override an official distro by saving a distro of the same name).
- `~/.pi/harnesses/` is created on demand (first write). A `.trash/` subdirectory holds
  backups of removed harnesses.
- Selectors and `/pi-distro list` label each entry's source: **Official** (the
  `msdavid/pi-distro` repo), **Local** (user-saved), or **GitHub (<owner>/<repo>)** for
  distros from other repos. Official distros come from a trusted repo and skip the GitHub
  security confirmation that other-repo distros require.
- Network failures degrade gracefully: if GitHub is unreachable, official distros are
  simply omitted and the catalogue falls back to local-only.

---

## 5. Provenance file

Every project that has had a distro applied carries a **provenance file** at
`./.pi/harness.md` (decision C3 — kept; living). It records which distro was applied and
is kept **updated as a side-effect of the distro commands themselves** (decision C5a — no
passive file-watcher).

The provenance file is itself a valid `harness.md` (same frontmatter + directives), plus a
provenance header injected at the top of the body:

```markdown
<!-- pi-distro provenance
     appliedHarness: <name>
     appliedVersion: <version>
     sourceCatalogue: <user|github:owner/repo[/subpath]>
     lastUpdated: <ISO8601>
-->
```

When `/pi-distro save` snapshots a project, the provenance file is regenerated to
reflect the *current* live config (it becomes the record of "this project's distro now").

---

## 6. Commands — `/pi-distro <subcommand>`

A single extension command `pi-distro` dispatches on its first arg. The skill
(`skills/pi-distro/SKILL.md`, `name: pi-distro`) provides agent guidance that the
non-deterministic phases rely on.

Invocations:
- `/pi-distro deploy`  (or `/pi-distro deploy <name>` to skip the selector, or `/pi-distro deploy <gh-repo>` for GitHub)
- `/pi-distro undeploy`  (no arg — removes the applied distro from the current project)
- `/pi-distro pick`  (or `/pi-distro pick <name>` or `/pi-distro pick <gh-repo>` — partial deploy: select components)
- `/pi-distro update`  (no arg — updates the applied distro if a newer version exists)
- `/pi-distro save`
- `/pi-distro list`
- `/pi-distro show <name|gh-repo>`
- `/pi-distro status`
- `/pi-distro remove <name>`
- `/pi-distro` (no arg) → print help (available subcommands + a one-line description each)

GitHub addresses use the format `owner/repo[/subpath]` (or full URLs). If the
argument to `deploy` or `show` contains a `/`, it is treated as a GitHub reference
and fetched via `git clone --depth 1` to a temp dir. See §6.1 and §6.4 for details.

### 6.1 `/pi-distro deploy`
**Purpose:** deploy a distro from the catalogue into the current project, collaborating
with the user (merge-don't-clobber), then update provenance.

Accepts an optional distro name: `/pi-distro deploy <name>` resolves the distro
directly (skipping the interactive selector); `/pi-distro deploy` with no arg shows
the selector. If the named distro is not found, errors with available names.
**Purpose:** deploy a distro from the catalogue into the current project, collaborating
with the user (merge-don't-clobber), then update provenance.

**Flow (extension-driven, then agent handoff):**
1. Read the effective catalogue (official ∪ user), parse each `harness.md` frontmatter (official distros via the GitHub Contents API listing).
2. If empty: `ctx.ui.notify("No distros found. Run /pi-distro save to create one.", "warning")` and return.
3. Present an interactive selector via `ctx.ui.select("Select a distro to deploy:", items)`
   where each item is formatted as `bold(name) — description` (the name is bolded via
   `ctx.ui.theme.bold()` for visual clarity; the redundant title is dropped). The
   returned value is the label string, matched back to the distro via `indexOf`.
4. If the user cancels (returns `undefined`), abort silently.
5. Load the chosen distro: read its full `harness.md` and list its bundled `files/` tree.
6. Build a **kickoff user message** for the agent that contains:
   - The full `harness.md` body (directives).
   - A manifest of the bundled files (relative source path → intended target path) and the
     absolute path of the distro `files/` dir on disk (so the agent can `read`/`cp` them).
   - **Current project state for conflict detection:** the already-active tools (from
     `ctx.getSystemPromptOptions().selectedTools`) and the packages already in
     `./.pi/settings.json`, so the agent can detect tool-name collisions *before* installing.
   - The explicit rule: **"Merge, don't clobber. For any target file that already exists,
     do not overwrite silently — show a diff and ask the user whether to overwrite, keep
     theirs, or merge. Merge JSON settings field-by-field. Append AGENTS.md content under
     a delimited section. Install pi packages with `pi install -l` (project-local) only after confirming with
     the user. Do NOT pre-add packages to ./.pi/settings.json by hand — `pi install -l`
     registers them on success (and leaves settings untouched on failure)."**
   - The **package-redundancy rule:** before installing any package, the agent evaluates
     whether its tools overlap an already-active tool — either an exact name collision or
     semantic redundancy (different names, similar function). It cross-checks against the
     already-active tools (and `pi list`). If overlap is detected, do NOT install blindly —
     offer the user: **skip** / **replace** (`pi remove -l <old>` then `pi install -l <new>`)
     / **keep both** / **cancel**. (Exact name collisions are non-fatal in pi — project-local
     tools shadow global ones — but redundancy leaves a confusing duplicate tool set.)
   - A **version note** comparing the incoming version against the project's existing
     provenance (`appliedVersion` in `./.pi/harness.md`), computed by the extension via
     `compareVersions(incoming, existing)`: **upgrade** (incoming > existing — proceed
     normally), **downgrade** (incoming < existing — ask user to confirm), **same version**
     (equal — ask user whether to skip or force re-deploy), **different distro** (existing
     `appliedHarness` != incoming name — treat as a distro switch), or **first deploy** (no
     existing provenance). The agent follows the note's guidance before proceeding.
   - Instruction to write/update `./.pi/harness.md` provenance when finished.
7. Inject the kickoff via `pi.sendUserMessage(kickoff)` (the agent is idle after the command
   handler returns, so this triggers a new turn). The interactive agent then completes the
   deployment while the user watches/interacts.

> The extension does NOT do file copying itself. It hands the bundled-file manifest +
> directives + merge rule to the agent, which performs the actual (interactive, merging)
> deployment. This is the "non-deterministic" choice (decision C4).

**GitHub deploy (trust gate):** If the argument contains a `/`, it is parsed as a
GitHub ref (`owner/repo[/subpath]`). The extension:
1. Shallow-clones the repo (`git clone --depth 1`) to a temp dir in `/tmp/`.
2. Reads the `harness.md` + `files/` from the clone (or subpath).
3. Displays a full dry-run preview (same as `/pi-distro show`) with a ⚠️ security warning.
4. Requires explicit confirmation via `ctx.ui.confirm()` — **no blind deploy from GitHub**.
5. On confirmation, sends the same kickoff as a local deploy (the `files/` dir points to
   the temp clone; `sourceCatalogue` is `github:owner/repo[/subpath]`).
6. On cancel, cleans up the temp dir and returns.
The temp dir is intentionally left in `/tmp/` (ephemeral) for the agent to read bundled
files from. There is no caching — every GitHub deploy re-clones.

### 6.1b `/pi-distro update`
**Purpose:** update the currently-applied distro if a newer version exists, with explicit
user confirmation. (No argument — reads the applied distro from provenance.)

**Flow:**
1. Read provenance from `./.pi/harness.md`. If none → notify "No distro applied" and return.
2. Resolve the *current* version of `appliedHarness` from the source:
   - If `sourceCatalogue` starts with `github:` → re-clone via `fetchGithubDistro()`
     (shallow clone to `/tmp/`).
   - Else → look up in the local catalogue via `readCatalogue()` + `findHarness()`.
     If not found (removed/renamed) → notify with a warning and return.
3. Compare versions via `compareVersions(current, applied)`:
   - **Equal** → notify "Already up to date (vX). Re-deploy with `/pi-distro deploy <name>`
     to force." and return (no action without user intent).
   - **Downgrade** (current < applied) → notify with a downgrade warning and return (updates
     are for newer versions; to downgrade, user runs `/pi-distro deploy <name>` and confirms).
   - **Upgrade** (current > applied) → continue to step 4.
4. Display a preview (`buildShowPreview`) so the user sees what the new version contains.
5. Ask via `ctx.ui.confirm("Apply the update?", "...vX → vY... Proceed?")`. If declined →
   clean up temp dir (if GitHub), notify "Update cancelled.", and return.
6. On confirmation → run `sendDeployKickoff()` (the standard deploy, which carries the
   version note showing "upgrade", merge rule, user-involvement rule, package-redundancy
   rule, etc.). The GitHub temp dir is left in `/tmp/` for the agent to read bundled files.

The update command never silently applies anything — it surfaces the available update,
previews it, and requires explicit confirmation. This is a specific instance of the
user-involvement principle.

### 6.1d `/pi-distro pick [name|gh-repo]`
**Purpose:** partial deploy — let the user select which components to apply from a distro
(packages, bundled files, settings, context, extensions), so they can combine pieces from
different distros to build their own configuration.

**Flow:**
1. Resolve the distro via the shared `resolveDistro()` helper (GitHub ref → shallow clone +
   trust gate; local → catalogue lookup or interactive selector).
2. Parse the distro into selectable components: `parsePackageList()` for packages,
   `listBundledFiles()` for bundled files, and the directives body (which may describe
   settings keys, context, extensions, themes, prompts, skills).
3. Send a kickoff listing all components grouped by category, with the full directives for
   reference, the current project state (for conflict detection), and a selection procedure.
4. The agent (interactively) walks the user through each category, letting them pick any
   subset via `ctx.ui.select`/`ctx.ui.confirm`, **surfaces cross-component dependencies**
   (e.g. an extension that needs a package the user skipped), and applies only the selected
   components with merge-don't-clobber + package-redundancy rules.
5. **No provenance is written** (option b) — a partial deploy is a custom config, not an
   applied distro. The agent suggests `/pi-distro save` to snapshot the result as a new
   distro (which writes clean provenance).

The natural loop: `/pi-distro pick <A>` → `/pi-distro pick <B>` → `/pi-distro save`.

### 6.1f `/pi-distro undeploy`
**Purpose:** remove an applied distro from the current project — the reverse of `deploy`.
(No argument — reads the applied distro from provenance.)

**Flow:**
1. Read provenance from `./.pi/harness.md`. If none → notify "No distro applied" and return.
2. Parse the directives from the provenance body (`extractBody` + `parsePackageList`) to
   identify what the distro intended to install. Read current project state:
   - `.pi/settings.json` packages (which distro packages are still installed).
   - Whether the `<!-- pi-distro: <name> -->` delimited section exists in `AGENTS.md`.
3. Send an undeploy kickoff with the directives, current state, and a removal procedure.
4. The agent (interactively) walks the user through removal category by category (packages,
   bundled files, AGENTS.md section, extensions), asking per component — show files before
   deleting, warn about dependencies, never silently remove.
5. Provenance (`./.pi/harness.md`) is removed last, after the user confirms the rest.
6. Recommend a restart (removed packages/extensions unload at next session start).

**Key constraint:** provenance records *intentions*, not the exact deploy outcome, so the
agent compares directives against the *current* state and lets the user decide. Removal is
destructive — the user-involvement rule applies doubly. Only works for full deploys
(partial `pick` deploys don't write provenance).

### 6.2 `/pi-distro save`
**Purpose:** snapshot the current live pi configuration of the project into the catalogue
as a new distro, OR update an existing distro in place. (Decisions D1a, D2.)

> **Design note (resolved):** Drafting a `harness.md` (title/description/directives) is a
> judgment call that requires an agent LLM turn. A command handler cannot span a turn to
> resume with `ctx.ui.select`, so the save flow is **fully agent-driven** (consistent with
> `/pi-distro deploy` and decision C4, "non-deterministic preferred"). The extension
> captures the snapshot + existing-distro list and injects a precise procedure; the agent
> drafts, confirms with the user, and performs the write (it has `bash`/`write`/`read`).

**Flow:**
1. Capture the live config snapshot via `ctx.getSystemPromptOptions()`. Extract:
   - `cwd` (the project dir)
   - `selectedTools` / `toolSnippets` (active tools)
   - `skills` (loaded skills, with paths)
   - `contextFiles` (AGENTS.md etc., with paths)
   - `promptGuidelines`, `appendSystemPrompt`, `customPrompt`
2. Also read raw config files from the project dir to capture things the snapshot doesn't:
   `./.pi/settings.json` (packages, extensions, skills, prompts, themes, tools, models),
   `./.pi/extensions/*`, `./.pi/prompts/*`, `./.pi/skills/**`, `./AGENTS.md`.
3. List existing **user** distro names from `~/.pi/harnesses/` (so the agent can offer
   update-existing and refuse official/GitHub distros, which are read-only locally).
4. Inject a kickoff user message (via `pi.sendUserMessage`) containing the snapshot, the raw
   config files, the existing-distro list, the user distros dir, and the precise save
   procedure (draft → confirm → choose save-as-new vs update-existing → write → backup on
   update → update provenance → report). The SKILL.md reinforces this procedure.
5. The agent (interactively, collaborating with the user) drafts the `harness.md`, confirms
   it, then:
   - **Save as new:** validate the slug, create `~/.pi/harnesses/<name>/`, write
     `harness.md`, and copy the project's bundled config files into `files/` (decision D3 —
     self-contained).
   - **Update existing:** pick from the user-distro list, back the old distro up to
     `~/.pi/harnesses/.trash/<name>-<timestamp>/`, then overwrite `harness.md` and refresh
     `files/`. Refuse if the chosen distro is an official/GitHub distro (read-only locally).
     **Bump the version:** read the old distro's `version` and increment it (patch for tweaks,
     minor for new capabilities, major for breaking changes). Never keep the same version.
     Propose the bumped version to the user for confirmation.
6. The agent updates the project's `./.pi/harness.md` provenance (decision C5a) to reflect
   the saved distro identity.
7. The agent reports: "Saved distro '<name>'. Run `/pi-distro deploy` elsewhere to deploy it."

### 6.3 `/pi-distro list`
**Purpose:** non-interactive catalogue listing.

Print a table to the agent output (via `pi.sendUserMessage` of a formatted block, or
`ctx.ui.notify` for a compact summary). Columns: `NAME`, `TITLE`, `VERSION`, `SOURCE`
(Official/Local/GitHub), `DESCRIPTION`. Group official distros first, then user distros, alphabetical within
each group. Show counts.

### 6.4 `/pi-distro show <name>`
**Purpose:** a **resolved dry-run preview** of what deploying the named distro would do —
NOT a raw cat of `harness.md`. (User redefined show.)

Print a structured audit plan:
- Frontmatter (name/title/description/version/tags).
- **pi packages** that would be installed (parsed from the directives section).
- **settings** that would be merged (the bundled `files/settings.json`, if present).
- **extensions / hooks** that would be created (bundled `.pi/extensions/*` + directives).
- **skills / prompts / themes** bundled or referenced.
- **bundled files** with their intended target paths.
- The full **agent directives** body (so the user sees the non-deterministic instructions).
- A footer: "Nothing is applied. Run `/pi-distro deploy` to apply."
- If `<name>` is omitted → error: "Usage: /pi-distro show <name|gh-repo>".
- If `<name>` not found → list available names.

**GitHub show:** If the argument contains a `/`, it is treated as a GitHub ref. The
extension shallow-clones the repo, reads the distro, displays the same preview, then
cleans up the temp dir. This lets users preview a GitHub distro before deploying.

### 6.5 `/pi-distro status`
**Purpose:** show the **currently configured details of the current project** (user-added).
Reads `./.pi/harness.md` provenance + the live snapshot (`ctx.getSystemPromptOptions()`)
+ `./.pi/settings.json`, and prints:
- The applied distro identity (name/version/source) from provenance, or "No distro
  provenance found in this project."
- An **update check**: for local sources, resolves the current catalogue version of the
  applied distro and compares — shows "Update available (vX → vY). Run `/pi-distro update`"
  if newer, or a version note if the applied version is newer than the catalogue
  (downgrade). For GitHub sources, shows a prompt to run `/pi-distro update` (which
  re-clones to check). No auto-fetch on status.
- The currently active tools, skills, context files, installed packages, and any local
  extensions/prompts/themes.
- Last-updated timestamp from provenance.

### 6.6 `/pi-distro remove <name>`
**Purpose:** delete a distro from the catalogue. (Decision: include remove.)
- Refuse if `<name>` is a GitHub distro (official or other-repo): "'<name>' is a GitHub distro and cannot be removed locally. Only user-saved distros in ~/.pi/harnesses/ can be removed."
- If not found → error with available names.
- Confirm via `ctx.ui.confirm("Remove distro?", "This deletes '~/.pi/harnesses/<name>/'...")`.
- Back up to `~/.pi/harnesses/.trash/<name>-<timestamp>/` then delete the distro dir.
- Does NOT touch any project that already deployed that harness.
- `ctx.ui.notify("Removed distro '<name>'. (Backup in ~/.pi/harnesses/.trash/)", "info")`.

### 6.7 Autocomplete
Register `getArgumentCompletions` for the `pi-distro` command returning subcommand
suggestions (`deploy`, `save`, `list`, `show`, `status`, `remove`) filtered by prefix, and
for `show`/`remove` additionally complete from the catalogue names.

---

## 7. The skill — `skills/pi-distro/SKILL.md`

`name: pi-distro`, `description:` precise enough that pi loads it when the user says
"set up a distro", "save my config as a distro", or runs `/pi-distro`.

The SKILL.md body guides the agent on:
- How `/pi-distro deploy` deployment works: follow `harness.md` directives, **merge-don't-clobber**
  for existing files (show diffs, ask overwrite/keep/merge; merge JSON field-by-field; append
  AGENTS.md under a delimited section), install pi packages with `pi install -l` (project-local) after confirming,
  and write/update `./.pi/harness.md` provenance when done.
- How `/pi-distro save` authoring works: given a live-config snapshot, draft a `harness.md`
  (frontmatter + directives) that reproduces the config; propose name/title/description;
  confirm with the user; then the extension writes the distro dir.
- The provenance header format and fields.
- Authoring conventions (refer to `docs/authoring.md`).

The skill is passive markdown (it does NOT spawn agents); the extension command drives the
flow and injects kickoff messages.

---

## 8. Seed distros (ship three)

### 8.1 `minimal`
A clean starting point.
- `harness.md`: title "Minimal", description "Clean starting point: a basic AGENTS.md and
  .pi/settings.json.", version 0.2.0.
- `files/AGENTS.md`: a minimal project-instructions template.
- `files/settings.json`: a minimal `.pi/settings.json` (e.g. `{ "packages": [] }`, maybe a
  thinking-level default).

### 8.2 `web-fullstack`
A React/Node flavor demonstrating variety.
- `harness.md`: title "Full-Stack Web", description "React/Node project with web-research
  + review skills, review-oriented context, and a sensible tools allowlist.", version 0.2.0,
  tags [web, react, node].
- `files/AGENTS.md`: project instructions oriented to a web full-stack workflow.
- `files/settings.json`: a `.pi/settings.json` with a tools allowlist (no `packages` array —
  packages are installed via `pi install -l`).
- Optionally `files/.pi/prompts/review.md`: a review prompt template.

### 8.3 `cc-knockoff`
A complete Claude Code–style interactive coding agent distribution. Built around
autonomous sub-agent spawning and coordination (the primary capability), with web
research, browser automation, live shell execution, model routing/fallback, and task
management integrated in support. Bundles a custom Claude-style status-line extension, a
deep-researcher `AGENTS.md` methodology, and a `.pi/settings.json` with high thinking + UI
prefs. Ten packages installed via `pi install -l` directives.
- `harness.md`: title "cc-knockoff", version 0.3.0, tags [full-config, claude-code-style].
- `files/AGENTS.md`: explore-before-acting working methodology.
- `files/settings.json`: thinking level, steering, UI prefs (no model/provider/auth, no theme).
- `files/.pi/extensions/claude-statusline.ts`: Claude-style status-line footer extension.

---

## 9. APIs used (grounded in pi-coding-agent v0.80.3 docs/extensions.md)

- `pi.registerCommand("pi-distro", { description, handler, getArgumentCompletions })` —
  `handler: async (args: string, ctx: ExtensionCommandContext) => void`.
- `ctx.ui.select(title, options: string[]) → Promise<string | undefined>`.
- `ctx.ui.confirm(title, message, opts?) → Promise<boolean>`.
- `ctx.ui.input(title, placeholder) → Promise<string | undefined>`.
- `ctx.ui.notify(message, "info" | "warning" | "error")`.
- `ctx.getSystemPromptOptions()` → `{ customPrompt, selectedTools, toolSnippets,
  promptGuidelines, appendSystemPrompt, cwd, contextFiles, skills }` (the live snapshot).
- `pi.sendUserMessage(content)` — inject a user message and trigger a turn (used for the
  non-deterministic handoff in `deploy` and the draft-authoring in `save`). Agent is idle
  after the command handler returns, so no `deliverAs` is needed.
- Node `fs`/`path`/`os` for catalogue + file operations.
- `fetch` (Node 22+ global) for the GitHub Contents API and raw frontmatter fetches.
- Frontmatter parsing: a minimal YAML parser (write a tiny one or read the fenced block; do
  NOT add a runtime yaml dependency — keep the package dependency-free apart from pi peers).

> **Verify before finalizing:** the exact return shape of `ctx.ui.select` with string arrays
> (returns the selected string), the fields present on `ctx.getSystemPromptOptions()` for a
> real session, and that `pi.sendUserMessage` from a command handler triggers a turn when the
> agent is idle. All three are documented in `docs/extensions.md`.

---

## 10. Dependencies & build

- No build step (pi loads `.ts` via jiti). `tsconfig.json` is for `tsc --noEmit` type
  checking only (matching the official pi-package-template).
- No runtime npm dependencies beyond pi peer deps. (No `js-yaml` etc. — write a tiny
  frontmatter parser.)
- Scripts: `typecheck` (`tsc --noEmit`), `lint`/`format` optional.

---

## 11. Documentation to ship & keep updated

- `README.md` — overview, install (`pi install npm:@msdavid/pi-distro`), the
  `/pi-distro` command reference (deploy/undeploy/pick/update/save/list/show/status/remove), the distro format,
  the catalogue concept, and a quickstart.
- `docs/authoring.md` — how to author a `harness.md` (frontmatter fields, bundled `files/`,
  directive conventions, merge-don't-clobber expectations).
- `SKILL.md` — the agent guidance (see §7).
- Inline comments in `extensions/index.ts` for each subcommand handler.

---

## 12. Acceptance criteria (verification)

1. `pi install npm:@msdavid/pi-distro` (or `pi install ./` locally) loads the package;
   `/pi-distro` is available as a slash command; the `pi-distro` skill is discoverable.
2. `/pi-distro` (no arg) prints help listing all subcommands.
3. `/pi-distro list` prints the official distros (`minimal`, `web-fullstack`, `cc-knockoff`) with
   SOURCE=Official, plus any user distros with SOURCE=Local.
4. `/pi-distro show minimal` prints a resolved preview (frontmatter + bundled files +
   directives), and clearly states nothing is applied.
5. `/pi-distro show nonexistent` errors with available names.
6. `/pi-distro deploy` presents a selector including all official distros (labelled [Official]) and user distros (labelled [Local]), and on selection injects a
   kickoff user message containing the directives + bundled-file manifest + merge-don't-clobber
   rule (verifiable from the session transcript / agent behavior).
7. `/pi-distro status` in a project with no provenance says so; in a deployed project
   reports the applied distro identity + live tools/skills/context.
8. `/pi-distro save` captures a live snapshot, drafts a `harness.md`, offers save-as-new
   and update-existing, writes to `~/.pi/harnesses/<name>/harness.md` (+ `files/`), and
   updates `./.pi/harness.md` provenance.
9. `/pi-distro remove <name>` deletes a user distro (with backup to `.trash/`) and
   refuses on a GitHub distro (official or other-repo).
10. `tsc --noEmit` passes (type check clean).
11. `npm pack --dry-run` includes `extensions/`, `skills/`, `docs/`, `README.md` (NOT `harnesses/` — official distros are fetched from GitHub, not shipped).
12. README + docs/authoring.md + SKILL.md are complete and accurate.
