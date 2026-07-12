# cc-knockoff

A complete Claude Code–style coding agent configuration for pi. The primary capability is
spawning and coordinating autonomous sub-agents; everything else — web research, browser
automation, live shell, model routing, task management — is integrated in support of that.

This is a personal draft shot at using the most popular pi coding packages to closely
resemble the capabilities of Claude Code. It's opinionated and not for everyone — but it
makes a great starting point to fork and make your own.

## What it sets up

- **`.pi/APPEND_SYSTEM.md`** — an explore-before-acting working methodology, appended to
  pi's **system prompt** at startup (not a context file): investigate before
  implementing, surface interpretations and tradeoffs, make surgical changes, keep
  solutions simple, execute against verifiable goals, and treat documentation as part of
  the implementation. Placing it in the system prompt gives stronger adherence than an
  `AGENTS.md` context file would, and leaves `./AGENTS.md` free for your own
  project-specific context.
- **`.pi/settings.json`** — high thinking level, one-at-a-time steering, hidden thinking
  blocks, and hardware cursor.

## EYU (Explain Your Understanding)

The `.pi/APPEND_SYSTEM.md` methodology includes an **EYU** rule: when you say "EYU",
the agent summarizes its understanding of your request, then stops and waits for your
approval before acting.

Two purposes:

1. **Reason first** — the agent explores the codebase and thinks through the request
   before responding, so its summary reflects real understanding, not a guess.
2. **Confirm alignment** — what you think you need and what the model has interpreted
   rarely match exactly. EYU surfaces that gap before any code is written, so you can
   correct course cheaply.

Use it for ambiguous, multi-step, or high-stakes tasks where acting on a
misinterpretation would be costly — and especially when describing complex, abstract
concepts that are hard to put into a precise prompt. EYU lets the model confirm its
understanding and produce a summary you can verify captured the logic, so you can
validate the hard-to-articulate parts before work begins.

## Packages installed (all project-local)

### Core — installed by default

Each row pairs a Claude Code feature with the pi package that provides it.

| Claude Code feature | Package | What it does |
|---|---------|-------------|
| Sub-agents | `npm:@tintinweb/pi-subagents` | Spawn specialized agents in isolated sessions with own tools/prompt/model/thinking; parallel execution, live widget, mid-run steering, resumption (**primary capability**) |
| Web search / fetch | `npm:pi-web-access` | Web search, URL fetching, GitHub cloning, PDF/video extraction |
| Browser (Chrome) automation | `npm:pi-agent-browser-native` | Real browser automation and web interaction |
| Live terminal | `npm:pi-bash-live-view` | Live terminal rendering for shell commands |
| Status line | `npm:pi-cc-status` | Claude Code–style status-line footer (model, dir, thinking level, context bar + cache %, git) with optional segments, accessibility mode, and command mode for reusing existing Claude Code statusline scripts verbatim; toggle with `/cc-status` |
| Model routing | `npm:@yeliu84/pi-model-router` | Model routing / fallback across providers |
| Provider integration (OpenRouter) | `npm:@robhowley/pi-openrouter` | OpenRouter provider integration |
| Todos | `npm:@juicesharp/rpiv-todo` | Task list management |
| Scheduled tasks / routines | `npm:@trevonistrevon/pi-loop` | Cron/event-based agent re-wake loops + background process monitoring — schedule agents to re-wake on time/events |
| Persistent goals | `npm:pi-goal` | `/goal` loops until complete, paused, or budget-limited |
| Structured clarifying questions | `npm:@juicesharp/rpiv-ask-user-question` | Structured questionnaire the model puts to the user (typed options instead of guessing) |
| Follow-up prompt suggestions | `npm:@mrclrchtr/supi-prompt-suggestions` | Advisory ghost-text next-prompt suggestions after each assistant response (accept with →, dismiss with Esc); ships disabled — the deployer configures the suggestion model with the user during deploy |

### Optional add-ons — offered during deploy, one at a time

These mimic additional Claude Code features the core does not cover. The deployer asks
before installing each; skip any you don't want (install later with `pi install -l <name>`).

| Claude Code feature | Package | What it does |
|---|---------|-------------|
| MCP (Model Context Protocol) | `npm:pi-mcp-adapter` | Connect pi to hundreds of external tools and data sources via MCP servers — Claude Code's primary extensibility surface; on-demand server discovery |
| Permission modes (plan / acceptEdits) | `npm:pi-pledit` | Plan mode and accept-edits mode, inspired by Claude Code's Shift+Tab cycle (default → acceptEdits → plan) |
| Auto memory | `npm:pi-memory` | Claude Code writes notes to itself across sessions (build commands, debugging insights, preferences); semantic search across daily logs, long-term memory, and a scratchpad |
| Checkpoint / undo | `npm:pi-rewind` | Per-tool snapshots with `/rewind` command and Esc+Esc shortcut, plus a redo stack — mirrors Claude Code's edit tracking and rewind-to-previous-state |
| Cost tracking / budget limits | `npm:pi-agent-budget` | Real-time spend widget with configurable budget caps (alternative: `npm:pi-usage-dashboard` for a fuller tokens/cost/latency footer) |
| Automated code review | `npm:pi-code-review` | Language-aware review after the agent writes or modifies files, mirroring Claude Code's `/code-review` |
| Remote control / channels | `npm:pi-chaos-relay` | Drive and answer the agent over Telegram and email via a CHAOS relay — Claude Code's "push events into a session" pattern (Telegram-only alt: `npm:pi-telegram-plus`; Discord alt: `npm:pi-discord-remote`) |
| Claude Code hook compatibility | `npm:@hsingjui/pi-hooks` | Adapts Claude Code's hook configuration format to pi's extension event system so existing PreToolUse/PostToolUse/session-start workflows can be reused (early release) |

### Not covered by any known package

These Claude Code features have no npm package match and are surfaced as limitations
rather than installs:

- **Output styles** (Proactive / Explanatory / Learning system-prompt presets) — no
  dedicated package; `AGENTS.md` and `--append-system-prompt` partially cover this.
- **`/run` + `/verify`** (launch and verify the running app) — no npm package; could be
  authored as a custom project skill.
- **IDE integration** (VS Code inline diffs, @-mentions, JetBrains plugin) — a separate
  surface (a VS Code extension, e.g. `pi-vscode-sr`), not a pi package; out of scope for
  this distro to install.

## Prerequisites

- **Auth and model routing** are not part of this distro — configure those independently
  (e.g. set `defaultProvider` and `defaultModel` in your global `~/.pi/settings.json`,
  or use OpenRouter via the `@robhowley/pi-openrouter` package installed above).
- **Restart pi** after deploying — packages and extensions load at startup.

## When to use

- You want a Claude Code–like experience in pi.
- You work on complex tasks that benefit from multi-agent coordination.
- You want an opinionated, batteries-included setup to fork and customize.
