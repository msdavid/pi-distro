# Trip Planner Agent

A pi distro that turns pi into a trip-planning assistant. It replaces pi's default
coding-assistant system prompt with a trip-planner system prompt, bundles the tools
useful for travel research, and adds a Claude-style status line via the
`pi-cc-status` package.

## What it sets up

**System prompt (`.pi/SYSTEM.md`)** — The core of the distro. Instead of "expert coding
assistant," the agent gets a trip-planner identity and a full planning methodology:

- **Working principles**: investigate before you book (gather primary sources, pull live
  data, cross-check 2–3 sources, note provenance); be honest about what you know
  (separate fact from interpretation, flag uncertainty, date your research); surface
  ambiguity (present interpretations, push back on bad premises, keep the traveller in
  the loop on judgment calls); trust but verify web sources (treat as untrusted data,
  prefer official sources, reconfirm near the date).
- **7-stage workflow**: anchor & constraints → wishlist & route geography → date
  skeleton → transport decisions → accommodation strategy → day-by-day plan → budget.
- **Document structure**: README (decisions log, open questions), itinerary (day-by-day
  + weather & packing), one doc per logistics domain (flights, transport, hotels),
  budget, options-by-day, project index, and a status-badge system (✅ booked, 📋 to
  book, 🔒 fixed, 🚗 drive, ❌ dropped).
- **Deliverables beyond markdown**: a single-file HTML booklet (zero-dependency,
  mobile-first, collapsible, color-coded by region, inline map pins) and a CSV-sourced
  Google My Map (one layer per region/type, unified `Name | Address | About | When |
  Notes` schema, reimport-and-merge maintenance).

**Context file (`AGENTS.md`)** — A near-empty placeholder with a comment: trip-specific
details go here. The generic methodology lives in SYSTEM.md. Pi auto-loads AGENTS.md and
appends it to the system prompt, so whatever the user fills in (dates, destinations,
travellers, anchors, booking specifics) gets injected into context.

**Settings (`.pi/settings.json`)** — High thinking level, one-at-a-time steering, hidden
thinking blocks, hardware cursor. Bundled without the packages array (packages are
registered via `pi install -l` on deploy).

**Status line (`pi-cc-status` package)** — a Claude Code–style status-line footer
showing model, directory, thinking level, a context-window bar gauge with cache %, and
git branch status, plus optional session/cost/tokens/version/providers segments.
Theme-integrated renderer with configurable layout and an accessibility mode, plus a
command mode that runs existing Claude Code statusline scripts verbatim. Toggle with
`/cc-status`; configure via `.pi/cc-status/config.json`. Enabled by default.

## Packages it installs

Ten pi packages, all project-local:

- **`@tintinweb/pi-subagents`** — parallel research sub-agents (the core capability for
  fan-out research across destinations or transport modes)
- **`pi-web-access`** — web search, URL fetching, GitHub cloning, PDF/video extraction
- **`pi-agent-browser-native`** — real browser automation for live booking engines and
  JavaScript-heavy sites
- **`@juicesharp/rpiv-todo`** — task list for tracking research and booking progress
- **`pi-goal`** — persistent autonomous goals that survive across turns
- **`@trevonistrevon/pi-loop`** — scheduled re-wake loops and background monitors
- **`@juicesharp/rpiv-ask-user-question`** — structured clarifying questions instead of
  guessing on judgment calls
- **`pi-btw`** — `/btw` side conversation channel for parallel work
- **`pi-cc-status`** — Claude Code–style status line (model, dir, context bar + cache %,
  git, plus optional session/cost/tokens segments); command mode runs existing Claude
  Code statusline scripts verbatim
- **`@mrclrchtr/supi-prompt-suggestions`** — ghost-text prompt suggestions (disabled by
  default; the deployer configures the suggestion model with you during deploy, or you
  can edit `.pi/supi/config.json` later)

## Workflow it targets

Trip planning is research-heavy and iterative. The distro is built for a workflow where
the agent:

1. Starts from an anchor event and constraints (dates, budget, travellers).
2. Researches destinations, routes, fares, and availability — pulling live data rather
   than relying on memory.
3. Builds a plan in stages, surfacing tradeoffs and asking the traveller to steer on
   judgment calls.
4. Produces a set of structured documents and keeps them in sync as the plan evolves.
5. Tracks bookings, cancellation deadlines, and confirmation codes.

## Prerequisites

- pi (`@earendil-works/pi-coding-agent`) installed globally.
- Auth and model/provider configured independently (this distro does not include them).
- A web-access provider and/or browser backend configured for `pi-web-access` and
  `pi-agent-browser-native` if you want live web research (see pi's providers docs).

## Deploying

```
/pi-distro deploy trip-planner
```

Or manually: copy the bundled files, `pi install -l` each package, and restart pi.
