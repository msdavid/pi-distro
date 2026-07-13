---
name: web-fullstack
title: Full-Stack Web
description: "React/Node project with web-research + review skills, review-oriented context, and a recommended restricted-tools launch mode."
version: 0.2.0
tags: [web, react, node]
---

# Full-Stack Web

## Bundled files
The following bundled files are provided under `files/` and should be placed into the
target project. For any path that already exists, do NOT overwrite — show the user a diff
and ask whether to overwrite, keep theirs, or merge. Merge JSON settings objects field by
field. Append (not replace) `AGENTS.md` content under a clearly-delimited section.

- `files/AGENTS.md` → `./AGENTS.md`
- `files/settings.json` → `./.pi/settings.json` (merge with existing settings)
- `files/.pi/prompts/review.md` → `./.pi/prompts/review.md`

## pi packages to install
Use `pi install -l` to install the following **project-locally** (writes to `./.pi/settings.json`
on success, and does nothing on failure). Confirm with the user before each install. Do NOT
pre-add these packages to the bundled `settings.json` — `pi install -l` is the single source
of truth that registers a package, so that a failed install never leaves a dangling entry
in settings.

- `npm:pi-browse` — web search (Brave/DuckDuckGo/Exa/Gemini) and content extraction for
  documentation lookup and API verification

## Context
This harness sets up a full-stack web project with React/Node conventions. The bundled
`AGENTS.md` contains frontend and backend conventions, testing guidance, and a code review
process. The `settings.json` sets a sensible default thinking level. A review prompt
template is included under `.pi/prompts/` for on-demand code reviews.

## Tools allowlist (launch flag, not a setting)
pi restricts tools via the `--tools` launch flag — there is no settings.json key for it.
After deploying, tell the user that for review-focused sessions they can launch pi with a
restricted tool set:

```bash
pi --tools read,bash,edit,write,grep,find,ls
```

Do NOT write a `tools` key into `.pi/settings.json` — pi ignores unknown settings keys,
so it would silently do nothing. If the user wants the restriction to be their default,
suggest a shell alias (e.g. `alias piweb='pi --tools read,bash,edit,write,grep,find,ls'`).

## Skills / prompts
- The `pi-browse` package (installed above) provides web research capabilities.
- A review prompt template is bundled at `files/.pi/prompts/review.md` and deployed to
  `./.pi/prompts/review.md`. Use it to run structured code reviews on changes.
