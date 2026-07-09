/**
 * `/pi-distro save` — snapshot the current project config as a reusable distro.
 * Agent-driven; see skills/pi-distro/SKILL.md for the collaborative authoring flow.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getUserHarnessesDir } from "./catalogue.ts";
import { display } from "./util.ts";

export async function handleSave(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const snapshot = ctx.getSystemPromptOptions();
  const cwd = snapshot.cwd;

  // Enumerate ALL project-local config files so nothing is missed — including per-extension/skill
  // config files, .pi/SYSTEM.md & .pi/APPEND_SYSTEM.md, theme files, subdirectory extensions,
  // nested skill dirs, pi-crew's project-local agents/teams/workflows, and the cross-tool
  // .agents/skills/ dir. Data/runtime dirs and our own provenance file are skipped. Ancestor
  // (parent-dir) AGENTS.md / .agents/skills are out of scope for a single-project distro and
  // are only surfaced via the snapshot's contextFiles list.
  // NOTE: .crew/ is handled separately below — it mixes authored config (agents/teams/workflows)
  // with runtime state (state/artifacts/worktrees/imports/audit/cache/graphs), so only its three
  // config subdirs are captured, not the whole tree.
  const SKIP_NAMES = new Set(["npm", "git", "sessions", "state", "tmp", "node_modules"]);
  const MAX_DUMP_BYTES = 16384;
  const configFiles: string[] = [];
  const pushFile = (fp: string) => {
    let st;
    try { st = statSync(fp); } catch { return; }
    if (st.size > MAX_DUMP_BYTES) {
      configFiles.push(`### ${fp}\n_(${st.size} bytes — read with the \`read\` tool if needed)_`);
      return;
    }
    try {
      configFiles.push(`### ${fp}\n\`\`\`\n${readFileSync(fp, "utf-8")}\n\`\`\``);
    } catch { /* unreadable (binary?) — skip */ }
  };
  const walk = (dir: string, isPiRoot: boolean) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (isPiRoot && entry.name === "harness.md") continue; // provenance — never bundle
      const fp = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_NAMES.has(entry.name)) continue;
        walk(fp, false);
      } else if (entry.isFile()) {
        pushFile(fp);
      }
    }
  };
  // Root context files — pi tries all four variants; only exact AGENTS.md was captured before.
  for (const name of ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"]) {
    const p = join(cwd, name);
    if (existsSync(p)) pushFile(p);
  }
  // Everything under .pi/: settings.json, SYSTEM.md, APPEND_SYSTEM.md, extensions/ (incl.
  // subdir extensions), skills/ (incl. nested), prompts/, themes/, and any per-extension/skill
  // config files (e.g. .pi/<name>.json) that we cannot predict by name.
  const piDir = join(cwd, ".pi");
  if (existsSync(piDir)) walk(piDir, true);
  // Cross-tool skills at project root only (ancestor .agents/skills/ are out of scope).
  const agentsSkills = join(cwd, ".agents", "skills");
  if (existsSync(agentsSkills)) walk(agentsSkills, false);
  // pi-crew project-local authored config: .crew/{agents,teams,workflows}/ (the legacy pi-crew
  // project root, which projectCrewRoot prefers over .pi/teams/ when it exists). Only these
  // three config subdirs are captured — the rest of .crew/ is runtime state (state/artifacts/
  // worktrees/imports/audit/cache/graphs). The .pi/teams/ and .pi/agents/ equivalents are
  // already captured by the .pi/ walk above. Files that are --copy-builtins copies of pi-crew's
  // shipped builtins should be deduped by the agent (see procedure) rather than bundled.
  const crewDir = join(cwd, ".crew");
  if (existsSync(crewDir)) {
    for (const sub of ["agents", "teams", "workflows"]) {
      const subDir = join(crewDir, sub);
      if (existsSync(subDir)) walk(subDir, false);
    }
  }

  // Existing user harnesses (so the agent can offer update-existing)
  const userDir = getUserHarnessesDir();
  const existing: string[] = [];
  if (existsSync(userDir)) {
    try {
      for (const entry of readdirSync(userDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== ".trash"
          && existsSync(join(userDir, entry.name, "harness.md"))) {
          existing.push(entry.name);
        }
      }
    } catch { /* ignore */ }
  }
  existing.sort();

  const tools = snapshot.selectedTools?.join(", ") ?? "(default)";
  const skillsList = snapshot.skills?.map((s) => `- ${s.name}: ${s.description}`).join("\n") ?? "_(none)_";
  const contextList = snapshot.contextFiles?.map((c) => `- ${c.path}`).join("\n") ?? "_(none)_";
  const existingList = existing.length > 0 ? existing.map((n) => `- \`${n}\``).join("\n") : "_(none yet)_";

  pi.sendUserMessage(`## Save current configuration as a distro

A live snapshot of this project's pi configuration follows. Draft a \`harness.md\` that
reproduces it, confirm with the user, then save it to the catalogue.

### Live snapshot
- **Working dir:** ${cwd}
- **Active tools:** ${tools}
- **Skills:**
${skillsList}
- **Context files:**
${contextList}

### Raw config files
${configFiles.length > 0 ? configFiles.join("\n\n") : "_(none found)_"}

### Existing user distros in the catalogue
${existingList}

Catalogue dir: \`${userDir}\`

### Procedure (follow exactly, collaborating with the user)

**1. Draft.** Analyse the snapshot and write a \`harness.md\` that reproduces this
configuration. Frontmatter MUST include: \`name\` (slug: lowercase a-z/0-9/hyphens, no
leading/trailing/consecutive hyphens), \`title\` (human-readable), \`description\`
(one-liner, <=300 chars), \`version\` (semver). Optionally \`author\` and \`tags\`.
The body should have directive sections (Bundled files, pi packages to install, System
prompt/SYSTEM.md if present, Themes, Context, Skills/prompts, and any per-extension/skill
config files) mirroring the live config.

**2. Propose & confirm.** Show the user the proposed \`name\`, \`title\`, \`description\`,
and the full draft. Ask for confirmation or edits. Do NOT proceed until the user confirms.

**3. Choose save target.** Ask the user whether to:
  - **(a) Save as a new distro** — ask for a name (validate the slug; if it collides with an
    existing user distro or a seed name, warn and ask whether to overwrite), then create
    \`~/.pi/harnesses/<name>/\`.
  - **(b) Update an existing distro** — let the user pick from the existing user distros
    above. Refuse to update a name that is NOT in the existing-user list (those are package
    seeds and are read-only). Before overwriting, back the old distro up: copy
    \`~/.pi/harnesses/<name>/\` to
    \`~/.pi/harnesses/.trash/<name>-<timestamp>/\` (create \`.trash/\` if needed).
    **Bump the version:** read the old distro's \`version\` field and increment it using
    semver: **patch** (\`0.1.0\` -> \`0.1.1\`) for small tweaks/bug fixes, **minor**
    (\`0.1.0\` -> \`0.2.0\`) for new capabilities or config additions, **major**
    (\`0.1.0\` -> \`1.0.0\`) for breaking changes (removed packages, changed conventions). Never
    keep the same version when updating — a distro's version should always reflect that
    something changed. Propose the bumped version to the user and let them confirm or adjust.

**4. Write the harness.** Write \`~/.pi/harnesses/<name>/harness.md\` with the confirmed
frontmatter + directives. Then copy the project's config files into
\`~/.pi/harnesses/<name>/files/\` so the harness is self-contained and reproducible. Copy
EVERY file listed under "Raw config files" above, preserving its path relative to the
project root:
  - root context (\`AGENTS.md\` / \`CLAUDE.md\` / case variants) -> \`files/<name>\`
  - \`.pi/settings.json\` -> \`files/.pi/settings.json\`
  - \`.pi/SYSTEM.md\` / \`.pi/APPEND_SYSTEM.md\` -> \`files/.pi/\` (same name)
  - \`.pi/extensions/**\` (incl. subdirectory extensions with \`index.ts\`/\`package.json\`)
    -> \`files/.pi/extensions/\` (preserve structure)
  - \`.pi/skills/**\` (incl. nested skill dirs) -> \`files/.pi/skills/\`
  - \`.pi/prompts/**\` -> \`files/.pi/prompts/\`
  - \`.pi/themes/**\` -> \`files/.pi/themes/\` (see theme dedup below)
  - \`.agents/skills/**\` (project root only) -> \`files/.agents/skills/\`
  - \`.crew/{agents,teams,workflows}/**\` (pi-crew project-local authored definitions)
    -> \`files/.crew/<sub>/\` (preserve structure). Do NOT copy the rest of \`.crew/\`
    (state/artifacts/worktrees/imports/audit/cache/graphs = runtime data).
  - any per-extension/skill config files (e.g. \`.pi/<name>.json\`) -> \`files/.pi/\` (same path)
  Use \`cp -r\` for directory trees. Only copy files that actually exist. Do NOT copy:
  \`./.pi/harness.md\` (provenance), \`./.pi/npm/\`, \`./.pi/git/\`, \`./.pi/sessions/\`,
  \`./.pi/state/\`, \`./.pi/tmp/\`, \`./.pi/.crew/\`, or any \`node_modules/\`.

  **Theme dedup:** before bundling a \`.pi/themes/<name>.json\`, check whether that theme
  name is already provided by an installed package (run \`pi list\`; package themes surface
  at \`~/.pi/agent/themes/\`). If a package provides it, do NOT bundle the file — reference
  it via the package install directive instead (a bundled copy would collide on deploy,
  exactly like the pi-crew \`crew-*\` themes). Only bundle genuinely custom themes not
  available from any package.

  **pi-crew agents/teams/workflows dedup:** \`.crew/agents/foo.md\` (or \`.pi/teams/agents/\`,
  \`.pi/agents/\`) may be a \`--copy-builtins\` copy of a pi-crew shipped builtin rather than
  custom-authored. Before bundling, compare against pi-crew's package builtins at
  \`<pkg>/agents/\` (and \`teams/\`, \`workflows/\`). If a file is an unmodified builtin copy,
  do NOT bundle it — the \`pi-crew\` install directive already provides it. Bundle only
  genuinely custom/authored definitions.

  **Extension/skill config:** some extensions or skills read their own config file (e.g.
  \`.pi/<extname>.json\`). These appear in the raw config files above. Bundle any that are
  project-local authored config; if a file is machine-specific runtime state rather than
  authored config, skip it and tell the user why.

  **Write a README.md:** also write \`~/.pi/harnesses/<name>/README.md\` — a
  human-readable description of the distro (a few paragraphs: what it sets up, which
  packages it installs and why, what workflow it targets, and any prerequisites). This is
  the extended description that complements the one-liner \`description\` in the
  frontmatter. The README is not consumed by the extension; it is for users browsing the
  catalogue or reading the distro on disk. Do NOT copy it into the target project on
  deploy — it lives only in the catalogue.

**5. Update provenance.** Update \`./.pi/harness.md\` in the project to reflect the saved
harness. The provenance file is a valid \`harness.md\` (the saved frontmatter + directives)
with this header at the top of the body:
\`\`\`
<!-- pi-distro provenance
     appliedHarness: <name>
     appliedVersion: <version>
     sourceCatalogue: user
     lastUpdated: <ISO8601 now>
-->
\`\`\`

**6. Report.** Tell the user: "Saved distro '<name>'. Run \`/pi-distro deploy\` elsewhere to
deploy it."`);
}
