# Authoring a Distro

A **distro** is a directory containing a `harness.md` file and an optional `files/`
directory. Distros are reusable pi configurations that can be deployed into any
project via `/pi-distro deploy` (from the local catalogue or GitHub), and live
projects can be snapshotted back into distros via `/pi-distro save`.

## Sharing distros via GitHub

Any GitHub repository containing a `harness.md` (and optional `files/`) at the root
or under a subpath can be deployed directly:

```
/pi-distro show owner/repo            # preview before deploying
/pi-distro deploy owner/repo           # deploy from repo root
/pi-distro deploy owner/repo/my-distro # deploy from a subpath
```

The extension shallow-clones the repo (`git clone --depth 1`), displays a security
warning + full preview, and requires explicit confirmation before proceeding. This
makes it easy to share distros — just push a repo with a `harness.md` and `files/`.

When authoring a distro intended for GitHub sharing, include a `README.md` so users
can understand what the distro does before deploying it.

## Directory layout

```
<name>/
├── harness.md                  # REQUIRED: frontmatter + directives
├── README.md                   # RECOMMENDED: extended human-readable description
└── files/                      # OPTIONAL: bundled files deployed into the target
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

The directory name **must match** the `name` field in the frontmatter.

## README.md (recommended)

Each distro should include a `README.md` alongside `harness.md`. While the frontmatter
`description` is a one-liner (≤300 chars) shown in selectors and listings, the README is
the extended human-readable description: a few paragraphs covering what the distro sets
up, which packages it installs and why, what workflow it targets, and any prerequisites.

The README is for users browsing the catalogue or reading the distro on disk. It is **not**
consumed by the extension and is **not** copied into the target project on deploy — it
lives only in the catalogue.

When you run `/pi-distro save`, the agent writes a `README.md` for the new distro as part
of the authoring flow. If you author a distro by hand, include one too.

## Frontmatter fields

The frontmatter is YAML between `---` fences at the top of `harness.md`.

| Field         | Required | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| `name`        | Yes      | Unique slug. Lowercase a-z/0-9/hyphens. Must match the directory name. |
| `title`       | Yes      | Human-readable title (shown in the selector).                     |
| `description` | Yes      | One-liner shown in the selector. ≤300 characters.                  |
| `version`     | Yes      | Semantic version (e.g. `1.0.0`, `0.1.0`). Bump on every update (see below). |
| `author`      | No       | Author name or handle.                                             |
| `tags`        | No       | Array of tags for categorisation (e.g. `[web, react, node]`).      |

Example:

```yaml
---
name: my-distro
title: My Distro
description: >
  A concise description of what this distro configures.
version: 1.0.0
author: Jane Doe
tags: [api, backend]
---
```

## Bundled `files/` directory

The `files/` directory contains files that are deployed into the target project
verbatim. The directory structure inside `files/` mirrors the target project layout:

| Source in `files/`                     | Target in project                |
|----------------------------------------|----------------------------------|
| `files/AGENTS.md`                      | `./AGENTS.md`                    |
| `files/settings.json`                  | `./.pi/settings.json`            |
| `files/.pi/extensions/hooks.ts`        | `./.pi/extensions/hooks.ts`      |
| `files/.pi/prompts/review.md`          | `./.pi/prompts/review.md`        |
| `files/.pi/skills/my-skill/SKILL.md`   | `./.pi/skills/my-skill/SKILL.md` |

The `harness.md` body should include a **Bundled files** section that lists each file
and its target path, so the agent knows what to deploy.

## Directive conventions

The body of `harness.md` (after the frontmatter) is agent-readable prose instructing
the agent how to set up the project. Use structured sections:

> **Authoring for `/pi-distro pick`:** since users may pick individual components from your
> distro, it helps to keep components as independent as possible and to state dependencies
> explicitly in the directives prose (e.g. "this extension requires the `pi-crew` package
> for its theme"). The agent uses these notes to warn users during a partial deploy.

### `## Bundled files`

List each bundled file with its target path and any merge instructions. This is the
manifest the agent uses during `deploy`.

```markdown
## Bundled files
- `files/AGENTS.md` → `./AGENTS.md`
- `files/settings.json` → `./.pi/settings.json` (merge with existing settings)
```

### `## pi packages to install`

List pi packages the distro depends on. The agent installs these with `pi install -l`
(**project-local** — writes to `./.pi/settings.json`) **or** `pi install` (**global** — writes
to `~/.pi/agent/settings.json`, shared across every project) per the user's deploy-time
scope choice, **only after confirming with the user** AND after a
**redundancy/conflict evaluation**: the agent compares each package's stated purpose against
the project's already-active tools and installed packages (both local and global, via
`pi list`), checking for both exact tool-name collisions and semantic redundancy (different
names, similar function). If overlap is detected, it offers the user **skip / replace /
keep both / cancel** instead of installing blindly. (Exact name collisions are non-fatal in
pi — project-local tools shadow global ones — but redundancy leaves a confusing duplicate
tool set, so the agent surfaces it for the user to decide.)

**Do not list these packages in the bundled `settings.json` `packages` array.**
`pi install -l` / `pi install` are the single mechanisms that register a package: each
installs the package AND appends the source to the corresponding settings file on success,
and leaves settings untouched on failure. This way a failed install never leaves a dangling,
unresolvable entry in settings.

#### Scope hint: `(global)`

By default, a package is suggested for **project-local** install. To suggest **global** as
the author-intended default, suffix the entry with `(global)`:

```markdown
## pi packages to install
- `npm:pi-browse` — for web search and content extraction
- `npm:my-shared-tool` (global) — a tool the user wants in every project
```

The hint is a **suggested default** for the deployment plan — it does not force global
install. At deploy time the user picks a preset (accept-defaults / all-global-where-safe /
customize) which governs the final scope. Use `(global)` for packages that are genuinely
user-wide (a favorite status-line, a shared utility); leave it off for project-specific
dependencies.

> **Marker placement:** the `(global)` / `(local)` marker must appear **between the
> package reference and the description dash** (as in the example above). A `(global)`
> that appears inside the description prose after the `—` dash is intentionally ignored,
> so descriptions can mention the word without changing the scope.

### `## Hooks`

Describe extensions/hooks to create under `./.pi/extensions/`. These are bundled as
files (e.g. `files/.pi/extensions/hooks.ts`) or described as instructions for the agent
to write.

### `## Context`

Describe what context to write or configure. This may reference the bundled
`AGENTS.md` or instruct the agent to create project-specific context.

### `## Skills / prompts`

Reference bundled skills (under `files/.pi/skills/`) and prompts (under
`files/.pi/prompts/`) that should be deployed, or describe skills/prompts the agent
should create.

## Install scope: local vs global

Every component a distro installs can be placed either **project-local** (the default,
under `./.pi/` — scoped to this project) or **global** (under `~/.pi/agent/` — shared
across every project and session on the machine). pi merges the two; project-local
shadows global on conflict. pi-distro's default philosophy is **project-local**, because
different projects need different harnesses — global is an opt-in choice the user makes at
deploy time.

### Per-type default scopes

| Component type | Default scope | Global allowed? |
|---|---|---|
| Packages | local | yes |
| Extensions | local | yes |
| Skills | local | yes |
| Prompts | local | yes |
| Themes | **global** | yes |
| settings.json merge | local | guarded (explicit confirm) |
| SYSTEM.md / APPEND_SYSTEM.md | local | double-confirm |
| AGENTS.md | local | guarded (explicit confirm) |

At deploy (and `/pi-distro pick`), the agent builds a **deployment plan** from the
directives — grouping every component with its default scope — and offers the user three
presets:

- **(a) Accept defaults** — keep each component at its default scope (recommended).
- **(b) All-global (where safe)** — flip every global-allowed component to global;
  dangerous types (settings, SYSTEM.md, AGENTS.md) stay local with a surfaced warning.
- **(c) Customize** — walk items one at a time, offering `local` / `global` / `skip`.

When a dangerous type's final scope is global, the agent surfaces the blast radius
("affects every project/session on this machine") and requires explicit confirmation
(double-confirm for SYSTEM.md/APPEND_SYSTEM.md).

### `## Global deployment notes`

If your distro is intended to place some bundled files **globally** (e.g. an extension that
should live at `~/.pi/agent/extensions/` rather than `./.pi/extensions/`), add a `## Global
deployment notes` section listing which file targets should go global:

```markdown
## Global deployment notes
- `.pi/extensions/my-shared-ext.ts` → deploy globally to `~/.pi/agent/extensions/my-shared-ext.ts`
- `.pi/themes/shared-theme.json` → deploy globally to `~/.pi/agent/themes/shared-theme.json`
```

The agent reads this note and places those files at the global path per the user's scope
choice. For packages, prefer the `(global)` marker in `## pi packages to install` instead.

## Merge-don't-clobber expectations

When a distro is deployed via `/pi-distro deploy`, **existing files are never
silently overwritten**. The agent:

1. Checks if each target file already exists.
2. If it does, shows the user a diff (or summary of differences).
3. Asks the user whether to **overwrite**, **keep theirs**, or **merge**.
4. For JSON files (e.g. `settings.json`): merges field-by-field when the user chooses
   merge — combining keys from both objects without destroying user customisations.
5. For `AGENTS.md`: appends bundled content under a delimited section rather than
   replacing. If the section already exists (re-deploy), replaces only that section.

This ensures distros compose with existing configurations rather than clobbering
them.

## Provenance file format

Every project that has had a distro applied carries a provenance file at
`./.pi/harness.md`. This file is itself a valid `harness.md` (the applied distro's
frontmatter + directives) with a provenance header injected at the top of the body:

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
- `sourceCatalogue`: `user` (from `~/.pi/harnesses/`) or `github:owner/repo[/subpath]` (official distros are `github:msdavid/pi-distro/harnesses/<name>`).
- `lastUpdated`: ISO 8601 timestamp of the last apply/save.

The provenance file is updated automatically by the `deploy`, `save`, and `undeploy`
commands. When `/pi-distro save` snapshots a project, the provenance file is
regenerated to reflect the current live config.

## Saving a live config as a distro

To capture your current project's pi configuration as a reusable distro:

1. Run `/pi-distro save` in the project.
2. The extension captures a live snapshot (tools, skills, context files, raw config
   files) and asks the agent to draft a `harness.md` that reproduces the configuration.
3. Review the draft — the agent proposes a `name`, `title`, `description`, and the
   directive sections. Confirm or request edits.
4. Choose **save as new** (prompts for a name, creates `~/.pi/harnesses/<name>/`) or
   **update existing** (selects from your user distros, backs up the old version to
   `~/.pi/harnesses/.trash/` before overwriting, and **bumps the version** — see below).
5. The extension writes `harness.md` + `files/` to `~/.pi/harnesses/<name>/` and
   updates `./.pi/harness.md` provenance.

### Versioning

The `version` field tracks which revision of a distro is applied. Two places use it:

- **On deploy**, the extension compares the incoming version against the project's existing
  provenance (`appliedVersion`) and includes a version note: **upgrade** (proceed normally),
  **downgrade** (asks the user to confirm — may regress features), **same version** (asks
  whether to skip or force re-deploy), or **different distro** (treat as a distro switch).
- **On save-update**, the agent bumps the version using semver:
  - **patch** (`0.1.0` → `0.1.1`) — small tweaks, bug fixes, doc updates.
  - **minor** (`0.1.0` → `0.2.0`) — new capabilities, added packages, config additions.
  - **major** (`0.1.0` → `1.0.0`) — breaking changes (removed packages, changed conventions,
    incompatible settings).

Never keep the same version when updating a distro — the version should always reflect
that something changed. When authoring a distro by hand, pick a starting version (e.g.
`0.1.0`) and bump it on each meaningful change.

Write versions as plain `MAJOR.MINOR.PATCH` — no `v` prefix. Prerelease suffixes
(`1.0.0-beta`) are tolerated and sort before their release, but plain releases are
recommended for distros.

The saved distro is immediately available in `/pi-distro list` and can be deployed
into other projects with `/pi-distro deploy`.
