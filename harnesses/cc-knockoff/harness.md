---
name: cc-knockoff
title: cc-knockoff
description: "A Claude Code–style coding agent distribution built around autonomous sub-agent spawning and coordination, with web research, browser automation, live shell, model routing, and task management in support. Includes a Claude-style status line and an explore-before-acting approach."
version: 0.5.0
tags: [full-config, claude-code-style]
---

# cc-knockoff

A complete interactive coding agent configuration that attempts to mimic as closely as
possible the functionality of today's Claude Code. The primary capability is spawning and
coordinating autonomous sub-agents; the remaining functionality is integrated in support
of that.

## Bundled files
The following bundled files are provided under `files/` and should be placed into the
target project. For any path that already exists, do NOT overwrite — show the user a diff
and ask whether to overwrite, keep theirs, or merge. Merge JSON settings field-by-field.
Append AGENTS.md content under a delimited section if one exists.

- `files/AGENTS.md` → `./AGENTS.md`
- `files/settings.json` → `./.pi/settings.json` (merge with existing settings)
- `files/.pi/extensions/claude-statusline.ts` → `./.pi/extensions/claude-statusline.ts`

## pi packages to install
Use `pi install -l` to install the following **project-locally** (writes to
`./.pi/settings.json` on success, leaves settings untouched on failure). Confirm with the
user before each install. Do NOT pre-add these to the bundled `settings.json` `packages`
array — `pi install -l` is the single registration mechanism.

- `npm:@tintinweb/pi-subagents` — Claude Code–style autonomous sub-agents: spawn
  specialized agents in isolated sessions, each with its own tools, system prompt, model,
  and thinking level; parallel execution, a live monitoring widget, mid-run steering, and
  session resumption (the primary capability of this distribution)
- `npm:pi-web-access` — web search, URL fetching, GitHub cloning, PDF/video extraction
- `npm:pi-agent-browser-native` — real browser automation and web interaction
- `npm:pi-bash-live-view` — live terminal rendering for shell commands
- `npm:@yeliu84/pi-model-router` — model routing / fallback across providers
- `npm:@robhowley/pi-openrouter` — OpenRouter provider integration
- `npm:@juicesharp/rpiv-todo` — task list management
- `npm:pi-goal` — persistent autonomous goals: `/goal` loops until complete, paused, or
  budget-limited, so long-running objectives survive across turns without manual babysitting
- `npm:@trevonistrevon/pi-loop` — cron/event-based agent re-wake loops and background
  process monitoring: schedule agents to re-wake on time or events and keep long-running
  or background work alive without manual babysitting
- `npm:@juicesharp/rpiv-ask-user-question` — structured questionnaire the model can put to
  the user when it would otherwise guess, with typed options instead of free-form replies
  (reduces ambiguous decisions and keeps the user in the loop on judgment calls)
- `npm:pi-btw` — `/btw` side conversation channel: opens a parallel pi sub-session with
  coding-tool access that runs immediately while the main agent is still busy, keeps a
  continuous thread by default (or contextless via `/btw:tangent`), and lets you inject
  the thread or a summary back into the main agent

**Tool-name conflict check:** before installing, cross-check each package's purpose
against the already-active tools in the target project (run `pi list`). If a package
overlaps an existing tool — either an exact name collision or semantic redundancy
(different names, similar function) — offer **skip / replace / keep both / cancel** instead
of installing blindly. (Exact name collisions are non-fatal in pi — project-local tools
shadow global ones — but redundancy leaves a confusing duplicate tool set.)

## Custom extension (bundled)
`files/.pi/extensions/claude-statusline.ts` is a Claude-style status-line footer
(model | dir | thinking level | context-window bar gauge + cache % | git branch status).
It auto-enables on session start and is toggleable via the `/claude-statusline` command.
It also **collapses tool outputs** on session start (disables the Ctrl+O effect) so the
working view stays clean, and thinking blocks are hidden by default.
Deploy it to `./.pi/extensions/claude-statusline.ts`; pi loads it via jiti on next start
(no build step). It depends only on pi core (`@earendil-works/pi-coding-agent`,
`@earendil-works/pi-ai`, `@earendil-works/pi-tui`) — all provided as peer deps.

## Settings (bundled)
`files/settings.json` provides the agent's defaults: high thinking level, one-at-a-time
steering, hidden thinking blocks, and hardware cursor. Tool outputs are collapsed on
start (via the status-line extension) for a clean working view. Merge with any existing `.pi/settings.json`
field-by-field. Auth and model/provider configuration are not part of this distribution —
configure those independently.

## Context
The bundled `AGENTS.md` is an explore-before-acting working methodology: investigate
before implementing, surface interpretations and tradeoffs, make surgical changes, keep
solutions simple, execute against verifiable goals, and treat documentation as part of the
implementation. Deploy it to `./AGENTS.md` so the agent follows these conventions.
