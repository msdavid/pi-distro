/**
 * Shared helpers and rule strings for the pi-distro command handlers.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Display markdown content in the TUI as a custom message (no LLM turn). */
export function display(pi: ExtensionAPI, content: string): void {
  pi.sendMessage({ customType: "pi-distro", content, display: true });
}

/** Compare two semver-ish version strings (tolerates a leading `v` and a
 *  `-prerelease` suffix; a prerelease sorts before its release, e.g.
 *  1.0.0-beta < 1.0.0). Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const s = (v || "0").trim().replace(/^[vV]/, "");
    const [core, ...preParts] = s.split("-");
    return {
      nums: core.split(".").map((n) => parseInt(n, 10) || 0),
      pre: preParts.join("-"),
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i++) {
    const va = pa.nums[i] ?? 0;
    const vb = pb.nums[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  if (pa.pre !== pb.pre) {
    if (!pa.pre) return 1; // release > its own prerelease
    if (!pb.pre) return -1;
    return pa.pre < pb.pre ? -1 : 1;
  }
  return 0;
}

/** Read the packages array from a pi settings.json, normalised to source strings
 *  (pi allows both string and `{ source, ... }` object entries). */
function readPackagesFile(settingsPath: string): string[] {
  if (!existsSync(settingsPath)) return [];
  try {
    const s = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (!Array.isArray(s.packages)) return [];
    return s.packages.map((p: string | { source: string }) => (typeof p === "string" ? p : p.source));
  } catch {
    return [];
  }
}

/** Read the packages array from <cwd>/.pi/settings.json, normalised to source strings. */
export function readProjectPackages(cwd: string): string[] {
  return readPackagesFile(join(cwd, ".pi", "settings.json"));
}

/** Read the packages array from ~/.pi/agent/settings.json (globally-installed
 *  packages), normalised to source strings. These are packages installed via
 *  `pi install <pkg>` (no `-l`), shared across every project on this machine. */
export function readGlobalPackages(): string[] {
  return readPackagesFile(join(homedir(), ".pi", "agent", "settings.json"));
}

export const SCOPE_RULE = `**Choose install scope per component — local vs global.** pi supports two install scopes, and the user chooses which to use for each component of this distro:

- **Project-local** (default) — writes to \`./.pi/\` (packages via \`pi install -l\` → \`./.pi/settings.json\`; extensions/skills/prompts/themes into \`./.pi/<type>/\`; settings into \`./.pi/settings.json\`; AGENTS.md at \`./AGENTS.md\`). Scoped to this project only. This is pi-distro's default philosophy — different projects get different harnesses.
- **Global** — writes to \`~/.pi/agent/\` (packages via \`pi install\` → \`~/.pi/agent/settings.json\`; extensions/skills/prompts/themes into \`~/.pi/agent/<type>/\`; settings into \`~/.pi/agent/settings.json\`; AGENTS.md at \`~/.pi/agent/AGENTS.md\`). Shared across **every project and session on this machine**. Opt-in, never the default.

pi merges global and project-local (project-local shadows global on conflict). Both coexist.

### Per-type default scopes (use these in the deployment plan unless the distro's directives mark a component \`(global)\`)
| Component type | Default scope | Global allowed? | Notes |
|---|---|---|---|
| Packages | local | ✅ | the headline global option |
| Extensions | local | ✅ | |
| Skills | local | ✅ | |
| Prompts | local | ✅ | |
| Themes | **global** | ✅ | themes are user-wide by nature; default global |
| settings.json merge | local | ⚠️ guarded | global settings affect every project — surface blast radius, require explicit confirm |
| SYSTEM.md / APPEND_SYSTEM.md | local | ⚠️ double-confirm | global = overrides the system prompt in EVERY session — very dangerous; require a second explicit confirmation |
| AGENTS.md | local | ⚠️ guarded | \`~/.pi/agent/AGENTS.md\` applies to all sessions — surface blast radius, require explicit confirm |

### Deployment-plan procedure (follow exactly)
**1. Build a deployment plan** before touching anything. Group every installable component from the directives by type, each with its default scope (per the table above, or the author's \`(global)\` hint if present). Render it as markdown so the user can see the whole picture at a glance, e.g.:
\`\`\`
📦 Packages (default: local)
  - npm:pi-crew              [local]
  - npm:pi-web-access        [local]
🎨 Themes (default: global)
  - my-theme.json            [global]
⚙️ settings.json            [local]   (merge 3 keys)
📝 SYSTEM.md                [local]   (global: guarded — affects all sessions)
\`\`\`

**2. Offer the user three presets** (use \`ctx.ui.select\`):
  - **(a) Accept defaults** — keep every component at its default scope (today's project-local behaviour for most things; themes go global). This is the fast path and the recommended option.
  - **(b) All-global (where safe)** — flip every *global-allowed* component to global. **Dangerous types** (settings.json, SYSTEM.md/APPEND_SYSTEM.md, AGENTS.md) stay local and you surface a warning explaining they were not flipped because their blast radius is machine-wide. Themes and any \`(global)\`-hinted items stay global.
  - **(c) Customize** — walk the user through components one at a time (\`ctx.ui.select\` is single-select, so go item by item), offering \`local\` / \`global\` / \`skip\` for each. Use the default scope as the highlighted option. \`ctx.ui.select\` returns undefined on cancel — treat that as \`skip\` for that item and continue.

**3. Apply the scope-safety guard.** Whenever the final scope for a **dangerous type** (settings.json, SYSTEM.md/APPEND_SYSTEM.md, AGENTS.md) is **global**, you MUST first surface the blast radius clearly and get an explicit confirmation: "This writes to \`~/.pi/agent/<file>\` and affects **every project and session on this machine**, not just this one. Confirm?" For SYSTEM.md/APPEND_SYSTEM.md global, require a **second** explicit confirmation — global system-prompt overrides are the most dangerous thing a distro can do. If the user declines, fall that component back to local (or skip if they prefer).

**4. Install/place per the chosen scope.** For packages: \`pi install -l <pkg>\` for local, \`pi install <pkg>\` for global — only after the redundancy/conflict check and user confirmation. For bundled files: write to the local path (\`./.pi/...\`, \`./AGENTS.md\`) or the global path (\`~/.pi/agent/...\`, \`~/.pi/agent/AGENTS.md\`) per the chosen scope, applying merge-don't-clobber at whichever target. **Never pre-add packages to settings.json by hand** — \`pi install\`/\`pi install -l\` registers them on success and leaves settings untouched on failure.

**5. Remember the scope for provenance & removal.** pi-distro does not record scope in provenance (provenance keeps the distro's directives). At \`undeploy\`/\`status\` time, the extension detects where each component actually landed by checking both \`./.pi/...\` and \`~/.pi/agent/...\` (and \`pi list\` for packages). So when you place a component globally, just note in your final report which components went global — the user can \`pi remove <pkg>\` (global) or delete from \`~/.pi/agent/...\` later, and \`/pi-distro undeploy\` will find them there.`;

export const MERGE_RULE = `**Merge, don't clobber.** For any target file that already exists (at whichever scope the user chose — \`./.pi/...\` for local or \`~/.pi/agent/...\` for global), do not overwrite silently — show a diff and ask the user whether to overwrite, keep theirs, or merge. Merge JSON settings field-by-field. Append AGENTS.md content under a delimited section. Install pi packages with \`pi install -l\` (project-local) or \`pi install\` (global) per the chosen scope, only after confirming with the user; do NOT pre-add packages to settings.json by hand — \`pi install\`/\`pi install -l\` registers them on success (and leaves settings untouched on failure).`;

export const USER_INVOLVEMENT_RULE = `**The user is in the loop for every decision.** pi-distro is a collaborative, agent-driven tool — never make a state-changing decision for the user. Before overwriting a file, installing a package, skipping a step, replacing a tool, applying an upgrade, or resolving any conflict (merge, redundancy, version downgrade, etc.), the agent must (1) surface the decision clearly (what it's about to do and why), (2) present the available options, and (3) wait for the user's explicit choice. Never silently skip, silently overwrite, silently substitute, or proceed on assumption. If a decision is ambiguous or the user is unsure, explain the tradeoffs and let them choose. The agent proposes; the user disposes.`;

export const PACKAGE_CONFLICT_RULE = `**Evaluate tool redundancy/conflicts before installing.** When you install a distro's packages, some may provide tools that overlap with already-active tools — either an **exact name collision** (two tools with the same name) or **semantic redundancy** (different names, but doing very similar things, e.g. two web-search tools, two browser tools, two todo tools). pi handles exact name collisions by load order (project-local tools shadow global ones; the conflict is a non-fatal diagnostic, not a fatal error — pi still starts), but redundancy leaves the user with duplicate capability and a confusing tool set. Before installing each package, the **agent must evaluate** whether its purpose overlaps an already-active tool (read the already-active tools, the project packages, and the global packages listed above; also run \`pi list\` if you need a fresh view). If redundancy or a conflict is detected, do NOT install blindly — present the user a choice: (a) **skip** installing it (the capability already exists); (b) **replace** — remove the overlapping package from wherever it lives (\`pi remove -l <old>\` if project-local, \`pi remove <old>\` if global) then install the new one at the chosen scope (\`pi install -l <new>\` or \`pi install <new>\`); (c) **keep both** — install it anyway (e.g. the user prefers the new tool, or they serve subtly different purposes); (d) **cancel**. Only proceed with the user's choice.`;
