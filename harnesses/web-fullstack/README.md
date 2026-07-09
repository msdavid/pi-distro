# web-fullstack

A full-stack React/Node project configuration with web research, code review, and a
restricted tool set.

## What it sets up

- **`AGENTS.md`** — frontend and backend conventions, testing guidance, and a code
  review process tailored to React/Node projects.
- **`.pi/settings.json`** — sensible defaults with a restricted tools allowlist (only
  the essential tools, keeping the agent focused).
- **`.pi/prompts/review.md`** — a review prompt template for on-demand structured code
  reviews.

## Packages installed

- **`npm:pi-browse`** — web search (Brave / DuckDuckGo / Exa / Gemini) and content
  extraction. Used for documentation lookup, API verification, and research.

## When to use

- You're building a React/Node full-stack application.
- You want web research built in for looking up docs and APIs.
- You want a structured code review workflow.
- You prefer a restricted tool set over the full default set.
