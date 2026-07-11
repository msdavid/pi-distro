# cc-knockoff

A complete Claude Code–style coding agent configuration for pi. The primary capability is
spawning and coordinating autonomous sub-agents; everything else — web research, browser
automation, live shell, model routing, task management — is integrated in support of that.

This is a personal draft shot at using the most popular pi coding packages to closely
resemble the capabilities of Claude Code. It's opinionated and not for everyone — but it
makes a great starting point to fork and make your own.

## What it sets up

- **`AGENTS.md`** — an explore-before-acting working methodology: investigate before
  implementing, surface interpretations and tradeoffs, make surgical changes, keep
  solutions simple, execute against verifiable goals, and treat documentation as part of
  the implementation.
- **`.pi/settings.json`** — high thinking level, one-at-a-time steering, hidden thinking
  blocks, and hardware cursor.
- **`.pi/extensions/claude-statusline.ts`** — a Claude-style status-line footer
  (model | dir | thinking level | context-window bar gauge + cache % | git branch status).
  Auto-enables on session start and **auto-expands tool outputs** (the Ctrl+O effect) so
  full output is visible by default. Toggle with the `/claude-statusline` command.

## EYU (Explain Your Understanding)

The `AGENTS.md` includes an **EYU** rule: when you say "EYU", the agent summarizes its
understanding of your request, then stops and waits for your approval before acting.

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

| Package | What it does |
|---------|-------------|
| `npm:@tintinweb/pi-subagents` | Claude Code–style autonomous sub-agents — spawn specialized agents in isolated sessions with own tools/prompt/model/thinking; parallel execution, live widget, mid-run steering, resumption (**primary capability**) |
| `npm:pi-web-access` | Web search, URL fetching, GitHub cloning, PDF/video extraction |
| `npm:pi-agent-browser-native` | Real browser automation and web interaction |
| `npm:pi-bash-live-view` | Live terminal rendering for shell commands |
| `npm:@yeliu84/pi-model-router` | Model routing / fallback across providers |
| `npm:@robhowley/pi-openrouter` | OpenRouter provider integration |
| `npm:@juicesharp/rpiv-todo` | Task list management |
| `npm:pi-goal` | Persistent autonomous goals — `/goal` loops until complete, paused, or budget-limited |
| `npm:@trevonistrevon/pi-loop` | Cron/event-based agent re-wake loops + background process monitoring — schedule agents to re-wake on time/events |
| `npm:@juicesharp/rpiv-ask-user-question` | Structured questionnaire the model puts to the user (typed options instead of guessing) |

## Prerequisites

- **Auth and model routing** are not part of this distro — configure those independently
  (e.g. set `defaultProvider` and `defaultModel` in your global `~/.pi/settings.json`,
  or use OpenRouter via the `@robhowley/pi-openrouter` package installed above).
- **Restart pi** after deploying — packages and extensions load at startup.

## When to use

- You want a Claude Code–like experience in pi.
- You work on complex tasks that benefit from multi-agent coordination.
- You want an opinionated, batteries-included setup to fork and customize.
