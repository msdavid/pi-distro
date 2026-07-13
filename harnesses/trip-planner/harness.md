---
name: trip-planner
title: Trip Planner Agent
description: "A research-first trip planning configuration — replaces pi's default coder prompt with a trip-planner system prompt (investigate-before-book methodology, 7-stage workflow, document/booklet/map deliverables), web/browser access for live fares, sub-agents for parallel research, todos & goals for booking tracking, plus a Claude-style status line via the pi-cc-status package."
version: 0.3.0
tags: [trip-planning, travel, research, documentation]
---

# Trip Planner Agent

A trip planning configuration that replaces pi's default coding-assistant system prompt
with a trip-planner system prompt. The agent investigates before it books (pulling live
fares, schedules, and availability via web/browser tools), follows a 7-stage planning
workflow (anchor → wishlist → date skeleton → transport → accommodation → day-by-day →
budget), produces structured trip documents (markdown + single-file HTML booklet +
CSV-sourced Google My Maps), and tracks bookings with todos, goals, and structured
clarifying questions. A Claude-style status line (provided by the `pi-cc-status`
package) keeps model, context-window usage, cache %, and git status visible.

## Bundled files
The following bundled files are provided under `files/` and should be placed into the
target project. For any path that already exists, do NOT overwrite — show the user a diff
and ask whether to overwrite, keep theirs, or merge. Merge JSON settings field-by-field.
For `.pi/SYSTEM.md`, if one exists, show a diff and ask (overwrite / keep theirs / merge
by appending under a delimited section).

- `files/.pi/SYSTEM.md` → `./.pi/SYSTEM.md` (**replaces pi's default system prompt**)
- `files/AGENTS.md` → `./AGENTS.md` (placeholder for trip-specific details)
- `files/settings.json` → `./.pi/settings.json` (merge with existing settings)

## System prompt (bundled)
`files/.pi/SYSTEM.md` replaces pi's default coding-assistant system prompt with a
trip-planning one. Pi takes a different code path when a custom system prompt is present:
it still auto-appends project context files (AGENTS.md), skills, the date, and the
working directory, but it no longer builds the default "Available tools" list, guidelines
section, or pi-documentation block. This SYSTEM.md carries over the essential pieces:
- The pi-documentation section (topic-to-file mapping) so pi questions still work
- General guidelines ("Be concise", "Show file paths", "Use bash for file operations")
- A trip-planner identity and the full planning methodology

Package-injected `promptGuidelines` are NOT copied manually — they are redundant with the
tool descriptions that pi sends via the API regardless of the system prompt. Auth and
model/provider configuration are not part of this distribution — configure those
independently.

## Context file (bundled)
`files/AGENTS.md` is a **near-empty placeholder** containing a comment explaining its
purpose: trip-specific details and instructions go here (dates, destinations, travellers,
anchor events, booking specifics, decisions log, open questions). The generic planning
methodology lives in `.pi/SYSTEM.md`. Pi auto-loads `AGENTS.md` as a context file and
appends it after the system prompt, so whatever the user fills in gets injected into
context.

## Status line (via package)
The Claude-style status-line footer is provided by the `pi-cc-status` package (see "pi
packages to install" below), not by a bundled extension. It renders model | dir |
thinking level | context-window bar gauge + cache % | git branch status by default, with
optional session/cost/tokens/version/providers segments, an accessibility mode, and a
command mode that runs existing Claude Code statusline scripts verbatim. It is
toggleable via `/cc-status` and configured via `~/.pi/agent/cc-status/config.json` or
`<cwd>/.pi/cc-status/config.json` (run `/cc-status:reload` after edits); enabled by
default.

## Settings (bundled)
`files/settings.json` provides the agent's defaults: high thinking level, one-at-a-time
steering, hidden thinking blocks, hardware cursor, and tree-filter mode. Merge with any
existing `.pi/settings.json` field-by-field. Auth and model/provider configuration are
not part of this distribution — configure those independently.

## pi packages to install
Use `pi install -l` to install the following **project-locally** (writes to
`./.pi/settings.json` on success, leaves settings untouched on failure). Confirm with
the user before each install. Do NOT pre-add these to the bundled `settings.json`
`packages` array — `pi install -l` is the single registration mechanism.

- `npm:@tintinweb/pi-subagents` — spawn specialized research sub-agents in isolated
  sessions with their own tools, prompt, model, and thinking level; parallel execution,
  live monitoring, mid-run steering, and session resumption. The core capability for
  fan-out research (e.g. studying multiple destinations or transport modes at once).
- `npm:pi-web-access` — web search, URL fetching, GitHub cloning, PDF/video extraction.
  Essential for gathering source material and checking live fares/availability.
- `npm:pi-agent-browser-native` — real browser automation and web interaction for
  sources that require JavaScript, login flows, or live booking engines.
- `npm:@juicesharp/rpiv-todo` — task list management to track research, planning, and
  booking progress.
- `npm:pi-goal` — persistent autonomous goals: `/goal` loops until complete, paused, or
  budget-limited, so long-running planning objectives survive across turns without manual
  babysitting.
- `npm:@trevonistrevon/pi-loop` — cron/event-based agent re-wake loops and background
  process monitoring: schedule agents to re-wake on time or events and keep long-running
  or background work alive.
- `npm:@juicesharp/rpiv-ask-user-question` — structured questionnaire the model can put
  to the user when it would otherwise guess, with typed options instead of free-form
  replies (reduces ambiguous decisions on scope/budget/priority during planning).
- `npm:pi-btw` — `/btw` side conversation channel: opens a parallel pi sub-session with
  coding-tool access that runs immediately while the main agent is still busy, keeps a
  continuous thread by default (or contextless via `/btw:tangent`), and lets you inject
  the thread or a summary back into the main agent.
- `npm:pi-cc-status` — a Claude Code–style status-line footer (model, dir, thinking
  level, context-window bar + cache %, git branch status, plus optional
  session/cost/tokens/version/providers segments). Theme-integrated default renderer
  with configurable layout/colors/thresholds and an accessibility mode, plus a command
  mode that runs existing Claude Code statusline scripts verbatim. Toggle with
  `/cc-status`; config at `~/.pi/agent/cc-status/config.json` or
  `<cwd>/.pi/cc-status/config.json` (`/cc-status:reload` after edits); enabled by
  default.
- `npm:@mrclrchtr/supi-prompt-suggestions` — advisory ghost-text prompt suggestions:
  after each assistant response, suggests a concise next prompt as dim ghost text in the
  editor (accept with →, dismiss with Esc); ships disabled by default — the deploying
  agent configures the suggestion model during deploy (see the post-install directive
  below); no `/supi-settings` package is required

**Tool-name conflict check:** before installing, cross-check each package's purpose
against the already-active tools in the target project (run `pi list`). If a package
overlaps an existing tool — either an exact name collision or semantic redundancy
(different names, similar function) — offer **skip / replace / keep both / cancel**
instead of installing blindly. (Exact name collisions are non-fatal in pi — project-local
tools shadow global ones — but redundancy leaves a confusing duplicate tool set.)

**Post-install — configure `npm:@mrclrchtr/supi-prompt-suggestions` with the user:**
this package ships **disabled by default** — no suggestions will appear until a suggestion
model is configured. This distro intentionally does **not** install `supi-settings` (the
`/supi-settings` UI); instead, the deploying agent configures the model directly by writing
the SuPi config file. Do this as a collaborative step with the user right after the install
succeeds — do not silently move on.

How the config works (from the package source):
  - The setting lives in a plain JSON file, keyed by section `promptSuggestions` with a
    single `model` field whose value is a canonical `provider/model-id` string, or
    `"disabled"` (the default).
  - **Project scope** file: `.pi/supi/config.json` (relative to the project root).
  - **Global scope** file: `~/.pi/agent/supi/config.json`.
  - Resolution is defaults ← global ← project, so a project value overrides a global one.
  - The chosen `model` **must** be one of PI's scoped enabled models. PI merges
    `enabledModels` from **two** settings files — global (`~/.pi/agent/settings.json`)
    and project (`.pi/settings.json`), with project overriding global — and the picker
    is empty if `enabledModels` is unset in **both** scopes. The chosen model must also
    have an API key configured.

Collaborate with the user through these steps:
  1. Check `enabledModels` in **both** `~/.pi/agent/settings.json` (global) and
     `.pi/settings.json` (project). If neither scope has any enabled models configured,
     **help the user configure them now** — do not just ask and move on:
       a. Ask which providers the user has API keys for (Anthropic, OpenAI, Google, etc.).
       b. Recommend a cheap, fast model for suggestions (suggestions fire after every
          assistant turn, so latency/cost dominate): `anthropic/claude-haiku` or
          `openai/gpt-4o-mini` are the de-facto standard picks for this pattern. Match
          the user's existing provider if they already have one configured.
       c. Write the `enabledModels` array (glob patterns, e.g. `["claude-haiku"]` or
          `["gpt-4o-mini"]`) into the scope the user prefers — default to project-local
          (`.pi/settings.json`) unless they want it global. Merge into the existing JSON;
          do NOT overwrite unrelated keys. Ensure the corresponding API key is set (via
          the provider's env var or PI's auth store) before continuing.
  2. List the currently enabled models (`provider/model-id` form) and ask the user which
     one to use for suggestions. Offer a recommendation if a cheap/fast model is present.
  3. Ask whether to set it **project-locally** (`.pi/supi/config.json`) or **globally**
     (`~/.pi/agent/supi/config.json`). Default to project-local unless the user says
     otherwise.
  4. Write the chosen scope's config file. Merge into any existing object — do NOT
     overwrite unrelated keys. The result should look like:
     ```json
     {
       "promptSuggestions": { "model": "provider/model-id" }
     }
     ```
     Create the parent directory if it does not exist. If the user declines to choose a
     model now, leave the setting at `"disabled"` and tell them they can set it later by
     editing the same file (or installing `npm:@mrclrchtr/supi-settings` for a UI).
  5. Confirm the outcome in the same message that confirms the install, e.g. "Installed.
  Configured prompt suggestions to use anthropic/claude-haiku in `.pi/supi/config.json`."
  Once configured, suggestions appear after each assistant response as dim ghost text
  (accept with →, dismiss with Esc). To change the model later, edit the config file or
  run `/reload` after updating it.
