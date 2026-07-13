# web-fullstack

A full-stack React/Node project configuration with web research, code review, and a
restricted tool set.

## What it sets up

- **`AGENTS.md`** — frontend and backend conventions, testing guidance, and a code
  review process tailored to React/Node projects.
- **`.pi/settings.json`** — a sensible default thinking level.
- **`.pi/prompts/review.md`** — a review prompt template for on-demand structured code
  reviews.
- **Restricted-tools launch mode** — pi restricts tools via the `--tools` launch flag
  (not a settings key), so the distro recommends
  `pi --tools read,bash,edit,write,grep,find,ls` (or a shell alias) for focused
  sessions instead of writing a non-functional key into settings.

## Packages installed

- **`npm:pi-browse`** — web search (Brave / DuckDuckGo / Exa / Gemini) and content
  extraction. Used for documentation lookup, API verification, and research.

## When to use

- You're building a React/Node full-stack application.
- You want web research built in for looking up docs and APIs.
- You want a structured code review workflow.
- You prefer a restricted tool set over the full default set (via the `--tools` launch
  flag the distro recommends).
