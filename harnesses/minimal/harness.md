---
name: minimal
title: Minimal
description: Clean starting point: a basic AGENTS.md and .pi/settings.json.
version: 0.1.1
---

# Minimal

## Bundled files
The following bundled files are provided under `files/` and should be placed into the
target project. For any path that already exists, do NOT overwrite — show the user a diff
and ask whether to overwrite, keep theirs, or merge. Merge JSON settings objects field by
field. Append (not replace) `AGENTS.md` content under a clearly-delimited section.

- `files/AGENTS.md` → `./AGENTS.md`
- `files/settings.json` → `./.pi/settings.json` (merge with existing settings)

## Context
This harness provides a minimal starting point for any project. After placing the bundled
files, ensure the `AGENTS.md` is tailored to the project's actual build/test commands and
conventions. The `settings.json` sets a sensible default thinking level — adjust as needed.

No additional pi packages are required for this harness.
