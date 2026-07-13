# pi-distro

[![version](https://img.shields.io/github/package-json/v/msdavid/pi-distro.svg)](https://github.com/msdavid/pi-distro/blob/main/package.json)
[![License: MIT](https://img.shields.io/github/license/msdavid/pi-distro.svg)](https://github.com/msdavid/pi-distro/blob/main/LICENSE)
[![pi-package](https://img.shields.io/badge/pi--package-%E2%9C%93-7c9eff.svg)](https://pi.dev/packages)

Distributions for [pi](https://github.com/earendil-works/pi-coding-agent) — the coding
agent. Inspired by Neovim distributions like [LazyVim](https://lazyvim.org),
[AstroNvim](https://astronvim.com), and [NvChad](https://nvchad.com), but for your AI
coding agent instead of your editor.

A **distro** is a named, reusable, composable configuration: skills, extensions, context,
settings, themes, and package install directives bundled together. Deploy one into any
project with a single command, and the agent collaborates with you to merge it into your
existing setup — nothing is silently overwritten.

## Prerequisites

- [pi](https://pi.dev/) installed (the coding agent this package extends).
- Node.js **>= 22.19.0** (pi's own requirement).
- An npm-scoped install of this package (see below).

## Get a fully-configured coder in 60 seconds

```bash
# 1. Install the package (in your shell)
pi install npm:@msdavid/pi-distro

# 2. Start pi, then deploy a distro from inside the session
#    (cc-knockoff = a Claude Code-style multi-agent coder)
pi
> /pi-distro deploy cc-knockoff

# 3. Restart pi — done.
```

That's it. You now have a multi-agent coding setup with web research, browser automation,
live shell, model routing, task management, a Claude-style status line, and an
explore-before-acting methodology — all configured and ready to go.

## ✨ Features

- 🚀 **One command to a full setup** — deploy a distro, restart, and you're coding
- 🧩 **Composable** — distros merge into your existing config, they don't clobber it. Use
  `/pi-distro pick` to select individual packages/configs from a distro and combine pieces
  from different distros into your own
- 👤 **You're in the loop for every decision** — the agent never silently overwrites, skips,
  substitutes, or chooses. Every state-changing decision (file merge, package install, tool
  conflict, upgrade) is surfaced with options, and the agent waits for your explicit choice
- 📦 **Project-local by default** — each project gets its own isolated configuration, so
  different projects can use different harnesses (coding, research, automation, trading…).
  Need a component everywhere? **Install globally** — at deploy time, choose
  accept-defaults / all-global / customize per component (with safety guards for
  machine-wide changes)
- 🔄 **Round-trip** — snapshot your live config back into a reusable distro with `/pi-distro save`
- 🐙 **GitHub distros** — deploy distros straight from any GitHub repo, so your personal
  config follows you to any machine (`/pi-distro deploy owner/repo`)
- 🎨 **System prompt overrides & overlays** — distros can ship `SYSTEM.md`, `APPEND_SYSTEM.md`,
  custom skills, prompts, and extensions — making them great for non-coding agent projects too

## What is a distro?

A distro is a directory with a `harness.md` file (frontmatter + agent directives) and an
optional `files/` directory (bundled config files). Think of it as a "starter template" for
your pi agent — but instead of a static config, it's a set of instructions that the agent
collaborates with you to apply.

```
my-distro/
├── harness.md          # frontmatter (name, description, version) + directives
├── README.md           # extended human-readable description
└── files/              # bundled files deployed into the target project
    ├── AGENTS.md
    ├── settings.json   # → .pi/settings.json (merged, not overwritten)
    └── .pi/
        ├── extensions/
        ├── skills/
        └── prompts/
```

When you deploy a distro, the agent reads the directives, places the bundled files
(asking before overwriting anything), installs the listed packages (with conflict
detection), and writes a provenance file. You stay in control the entire time.

## Why project-level, not global?

Most agent tools configure themselves globally — one config for all projects. pi-distro
takes a different approach: **each project gets its own configuration, scoped to that
project's `.pi/` directory.**

The biggest reason is this: **not every project needs the same harness.** A coding
project, a research project, an automation project, and a trading project each want a
fundamentally different agent — different tools, different skills, different system
prompt, different workflow. One global config trying to be everything ends up being
nothing well. Project-level distros let each project get exactly the harness it needs.

This matters beyond coding, too. Pi's flexibility — system prompt overrides (`SYSTEM.md`,
`APPEND_SYSTEM.md`), custom skills, prompts, and extensions — means the same agent
framework serves a huge range of use cases, and project-level distros are what make that
practical: the coding agent in one repo, the information-gathering agent in another, the
implementation/automation agent in a third — each isolated, each reproducible.

Other advantages:

- **Reproducibility** — anyone who deploys the same distro gets the same setup. No
  "it works on my machine" because of a global config difference.
- **Isolation** — your React project doesn't need the same tools as your Python API, and
  neither needs the tools your trading bot uses. Project-level configs keep them separate.
- **Portability** — the config travels with the project (`.pi/` is part of the repo).
  Clone the repo, deploy the distro, and you're set up.
- **Experimentation** — try a distro in a throwaway project without touching your
  global setup. Don't like it? Just delete the `.pi/` directory.
- **Composability** — different distros for different projects, without conflicts.

You can still use global packages and settings alongside project-level ones — pi merges
them. But the distro itself lives at the project level.

## Installing locally vs globally

Although pi-distro defaults to **project-local** installation (so each project gets its own
isolated harness), you can choose to install any component **globally** — shared across
every project and session on your machine. This is an opt-in choice made at deploy time; the
project-local default is never changed silently.

When you run `/pi-distro deploy` (or `/pi-distro pick`), the agent builds a **deployment
plan** listing every component with its default scope, then offers three presets:

- **Accept defaults** — keep each component at its default scope (recommended). Most things
  go project-local; themes default to global (they're user-wide by nature).
- **All-global (where safe)** — install every safe component globally. Dangerous types
  (settings, `SYSTEM.md`, `AGENTS.md`) stay project-local with a surfaced warning, because
  their blast radius is machine-wide.
- **Customize** — walk components one at a time and pick `local` / `global` / `skip` for each.

### What can go global

| Component | Default | Global? |
|---|---|---|
| Packages | local | ✅ |
| Extensions | local | ✅ |
| Skills | local | ✅ |
| Prompts | local | ✅ |
| Themes | **global** | ✅ |
| `settings.json` merge | local | ⚠️ guarded (explicit confirm) |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | local | ⚠️ double-confirm |
| `AGENTS.md` | local | ⚠️ guarded (explicit confirm) |

Global placement writes to `~/.pi/agent/` (packages via `pi install` →
`~/.pi/agent/settings.json`; extensions/themes/skills/prompts into `~/.pi/agent/<type>/`).
Project-local writes to `./.pi/` (packages via `pi install -l`). pi merges the two;
project-local shadows global on conflict.

### Tracking global installs

Provenance (`./.pi/harness.md`) records the distro's directives — it does **not** record
scope. So `/pi-distro status` and `/pi-distro undeploy` detect where each component
actually landed by checking **both** `./.pi/...` and `~/.pi/agent/...` (plus `pi list` for
packages). When you undeploy, the agent offers the right removal command per location
(`pi remove -l` for local, `pi remove` for global). `/pi-distro save` captures
globally-installed config too (marked `(global)` in the snapshot), so saved distros stay
reproducible.

### Authoring a distro with a global hint

Distro authors can suggest a global default for a package with the `(global)` marker — see
[docs/authoring.md](docs/authoring.md). The hint is a suggested default; the user's
preset still governs at deploy time.

## Workflows

### Global setup (install once, use everywhere)

```bash
# Install pi-distro globally — makes /pi-distro available in every session
pi install npm:@msdavid/pi-distro
```

### Per-project setup (deploy a distro into a project)

```bash
# In your project directory:
/pi-distro deploy              # interactive selector
/pi-distro deploy minimal      # deploy by name
/pi-distro deploy owner/repo   # deploy from GitHub
```

### Make it yours, then save it

```bash
# After customizing your project's config:
/pi-distro save                # snapshots your live config as a reusable distro

# Now deploy it into other projects:
/pi-distro deploy my-distro
```

### Pick pieces from a distro (partial deploy)

You don't have to take a whole distro. `/pi-distro pick` lets you select which components
to apply — just the packages you want, or a single extension, or a subset of the settings.
This is how you combine pieces from different distros to build your own:

```bash
/pi-distro pick cc-knockoff     # pick, say, just pi-subagents + the statusline
/pi-distro pick web-fullstack      # then add web research from another distro
/pi-distro save                    # snapshot the combination as your own distro
```

Run `/pi-distro pick` with no argument to choose from the interactive selector (same as
`/pi-distro deploy`). You can also pick from a GitHub distro:
`/pi-distro pick owner/repo`.

The agent walks you through each category (packages, bundled files, settings, context) one
at a time, lets you pick any subset, and **surfaces dependencies** — e.g. if you pick the
statusline extension but skip the package that provides its theme, the agent warns you and
asks how to proceed. Nothing is applied without your explicit choice. A partial deploy
doesn't write provenance (it's a custom config, not an applied distro) — run
`/pi-distro save` to capture the result as a clean, reusable distro.

### Check what's applied

```bash
/pi-distro status              # shows the applied distro + live config
/pi-distro list                # lists all available distros
/pi-distro show cc-knockoff  # dry-run preview of what a distro would do
```

### Bring your config to any machine

A common pattern when you work across multiple machines (laptop, desktop, server, a
fresh box) is to **maintain your personal distro in a GitHub repo** and deploy it to any
new machine in seconds. Your configuration follows you everywhere, identical on each
machine.

```bash
# One-time setup, on any machine:
pi install npm:@msdavid/pi-distro

# Then, on any new machine:
pi install npm:@msdavid/pi-distro        # install pi-distro
cd your-project
/pi-distro deploy owner/your-distro-repo   # your full config, applied
# restart pi — done.
```

To create your own: build up a project config you like, run `/pi-distro save` to snapshot
it, then push the resulting `~/.pi/harnesses/<name>/` directory to a GitHub repo. Now that
repo *is* a distro — deployable from anywhere. Update the repo, and every machine can pull
the latest with `/pi-distro deploy owner/repo` again (it merges with whatever's already
there).

### Community distros

GitHub distros also enable **community collaboration**. Anyone can publish a distro to a
GitHub repo and share it — a workflow setup, a specialized research agent, a team's
coding conventions, a niche toolchain — and anyone else can deploy it with a single
command:

```bash
/pi-distro show someone/their-distro   # preview before deploying
/pi-distro deploy someone/their-distro # apply it to your project
```

Found a distro that fits your workflow? Deploy it. Tweaked it to better suit your needs?
Run `/pi-distro save` and publish your own. This is how a shared library of pi
configurations grows — each distro a reusable starting point that others can fork, adapt,
and re-share. (Always review a community distro before deploying it — see the
[security note](#-experimental--please-read) below.)

## Command reference

All interaction happens through a single slash command — there is no standalone CLI.

| Command | Description |
|---------|-------------|
| `/pi-distro` | Print help |
| `/pi-distro deploy [name\|gh-repo]` | Deploy a distro (interactive selector if no arg) |
| `/pi-distro undeploy` | Remove an applied distro from the current project |
| `/pi-distro pick [name\|gh-repo]` | Partial deploy: pick which packages/configs to apply |
| `/pi-distro update` | Update the applied distro if a newer version exists |
| `/pi-distro save` | Snapshot your live config as a new distro |
| `/pi-distro list` | List all distros in the catalogue |
| `/pi-distro show <name\|gh-repo>` | Dry-run preview of a distro |
| `/pi-distro status` | Show the current project's distro status |
| `/pi-distro remove <name>` | Delete a user-saved distro |

**GitHub addresses** for `show` and `deploy` use the format `owner/repo[/subpath]`:
```
/pi-distro show owner/repo
/pi-distro deploy owner/repo/my-distro
/pi-distro deploy https://github.com/owner/repo
```

## The catalogue

The effective catalogue is the union of:

- **Official distros** — fetched dynamically from the [`msdavid/pi-distro`](https://github.com/msdavid/pi-distro)
  repo's `harnesses/` directory on GitHub (no longer bundled inside the npm package, so
  new official distros ship by pushing to the repo — no npm release needed). The catalogue
  is listed via the GitHub Contents API and each distro is cloned on demand when you
  select it. Currently:
  - **minimal** — clean starting point: basic `AGENTS.md` + `.pi/settings.json`.
  - **web-fullstack** — React/Node project with web research, review skills, restricted tools.
  - **cc-knockoff** — a Claude Code–style multi-agent coder (see below).
- **User distros** — saved by you to `~/.pi/harnesses/<name>/` via `/pi-distro save`.
- **GitHub distros** — fetched on-demand from any GitHub repo (`/pi-distro deploy owner/repo`).
- **Partial/combined configs** — built from `/pi-distro pick` across multiple distros, then
  saved as a user distro.

Selectors and `/pi-distro list` show each distro's source clearly: **Official** (the
`msdavid/pi-distro` repo), **Local** (your `~/.pi/harnesses/`), or **GitHub (<owner>/<repo>)**
for distros from other repos.

If GitHub is unreachable (offline, or the unauthenticated API rate limit is hit), the
catalogue degrades to local-only and `/pi-distro list`, `/pi-distro status`, and the
selectors say so explicitly — official distros are temporarily hidden, not gone.

On a name collision, the **user distro takes precedence** — save a distro with the same
name as an official distro to override it. Official distros come from a trusted repo (the
package's own repo), so they skip the GitHub security confirmation that other-repo
distros require.

### cc-knockoff

`cc-knockoff` is the author's draft shot at using the most popular pi coding packages to
closely resemble the capabilities of Claude Code. It's opinionated — spawning and
coordinating autonomous sub-agents is the primary capability, with web research, browser
automation, live shell, model routing, and task management integrated in support. It
includes a Claude-style status line and an explore-before-acting methodology.

It's a great starting point: deploy it, customize it, then `/pi-distro save` it as your own.

## Beyond coding

Distros aren't just for coding. Not every project is a coding project — some are about
**information gathering**, some are about **implementation or automation**, some are
**research**, some are **analysis**. Because distros can ship `SYSTEM.md` (system prompt
overrides), `APPEND_SYSTEM.md`, custom skills, prompts, and extensions, they configure
the agent for *any* kind of agentic work, not just writing code:

- **Market research & trading** — the author's team uses a targeted distro for
  market research and trading: an agent configured for market intelligence, data
  analysis, and execution across research, analysis, and trading sub-agents.
- **Information gathering** — distros that configure web research + data extraction
  workflows for market intelligence, competitor analysis, or due diligence.
- **Research pipelines** — distros that set up structured research + synthesis agents.
- **DevOps / automation** — distros that configure shell-heavy agents for
  infrastructure tasks and implementation work.

This is where project-level configuration really shines: the coding distro in your app
repo, the research distro in your intelligence repo, the targeted trading distro your
team uses for market research — each project gets the right harness for its job. If your
agent project benefits from a reproducible, shareable configuration, a distro works for
it.

## Creating & updating distros

### Save your live config as a distro

```bash
/pi-distro save
```

The extension captures a full snapshot of your project's configuration — tools, skills,
context files, and every config file under `.pi/`, `.crew/{agents,teams,workflows}/`, and
`.agents/skills/`. The agent drafts a `harness.md` that reproduces it, you confirm, and
it's saved to `~/.pi/harnesses/<name>/` with a `README.md` describing the distro.

### Author a distro by hand

Create a directory under `~/.pi/harnesses/<name>/` (or contribute an official distro via a
PR to the [`msdavid/pi-distro`](https://github.com/msdavid/pi-distro) repo's `harnesses/`
dir)
with a `harness.md` and optional `files/`. See
[docs/authoring.md](docs/authoring.md) for the complete format reference — frontmatter
fields, bundled file conventions, directive sections, and merge-don't-clobber
expectations.

### Update an existing distro

Run `/pi-distro save` again — it offers to update an existing distro (backing up the old
version to `~/.pi/harnesses/.trash/` before overwriting, and bumping the version — see
below).

### Update an applied distro

When a distro you've applied to a project gets a new version (the author bumped it in the
catalogue or pushed a new commit to the GitHub repo), `/pi-distro update` brings your
project up to date:

```bash
/pi-distro status   # shows applied version + whether an update is available
/pi-distro update   # fetches the latest, shows what changed, asks before applying
```

The update command reads the applied distro from provenance, fetches the current version
from the catalogue (or re-clones the GitHub repo), compares versions, and — if a newer
version exists — shows you a preview and **asks you to confirm** before re-deploying. It
never silently applies anything. If you're already up to date, it says so and does
nothing. Downgrades are flagged as warnings (updates are for moving to a newer version).

### Remove an applied distro

`/pi-distro undeploy` is the reverse of `deploy` — it removes a distro's components from
the current project:

```bash
/pi-distro undeploy   # walks you through removing the applied distro
```

The agent reads the applied distro's directives from provenance, compares them against
your project's *current* state (since you may have customized things after deploy), and
walks you through removal category by category — packages, bundled files, the `AGENTS.md`
delimited section, extensions. **It asks before removing anything** — you may have
customized a file or decided to keep a package, so you choose what to remove and what to
keep per component. Provenance is removed last, after you confirm the rest. Restart pi
afterward so removed packages/extensions fully unload.

> **Note:** `/pi-distro undeploy` works for full deploys (which write provenance). A
> partial deploy via `/pi-distro pick` doesn't write provenance — there's nothing to
> undeploy as a unit; just remove the individual components you picked.

### Versioning

Every distro has a `version` (semver). It's tracked in two places:

- **On deploy**, pi-distro compares the incoming version against the project's existing
  provenance and tells the agent what kind of deploy it is: an **upgrade** (proceed
  normally), a **downgrade** (asks you to confirm — may regress features), the **same
  version** (asks whether to skip or force re-deploy), or a **different distro** (treated
  as a distro switch). Run `/pi-distro status` to see which version is applied.
- **On save-update**, the agent bumps the version using semver: **patch** for small
  tweaks, **minor** for new capabilities, **major** for breaking changes. The version
  always reflects that something changed.

This means re-deploying a distro you've updated is safe and intentional — you'll always
know whether you're upgrading, downgrading, or re-applying the same version.

## ⚠️ Experimental — please read

This project is **experimental** and was **fully coded with AI**. It has only been tested
by its author — there are no guarantees it will work for you. Things may break, and the
format may change between versions.

**Installing unknown distros is dangerous.** A distro can install arbitrary npm packages,
write extensions that execute code, inject agent instructions, and modify your project
configuration. Before deploying any distro — especially one fetched from GitHub — review
its `harness.md`, package list, and bundled files carefully. Use `/pi-distro show` to
preview what a distro would do before deploying it.

Everything is provided **as-is**, without warranty of any kind. Security is **your
responsibility** — review what you install, trust only sources you control, and deploy in
projects you can afford to break.

If you find bugs, have suggestions, or want to contribute fixes, please
[open an issue](https://github.com/msdavid/pi-distro/issues) or submit a pull request.
This is an open project and contributions are welcome.

## License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 [msdavid](https://github.com/msdavid).

This project is experimental and was fully written with AI assistance; it is provided
as-is without warranty. See the notice above before installing unknown distros.
