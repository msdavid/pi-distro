/**
 * Shared helpers and rule strings for the pi-distro command handlers.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Display markdown content in the TUI as a custom message (no LLM turn). */
export function display(pi: ExtensionAPI, content: string): void {
  pi.sendMessage({ customType: "pi-distro", content, display: true });
}

/** Compare two semver-ish version strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = (a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = (b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/** Read the packages array from <cwd>/.pi/settings.json, normalised to source strings. */
export function readProjectPackages(cwd: string): string[] {
  const settingsPath = join(cwd, ".pi", "settings.json");
  if (!existsSync(settingsPath)) return [];
  try {
    const s = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (!Array.isArray(s.packages)) return [];
    return s.packages.map((p: string | { source: string }) => (typeof p === "string" ? p : p.source));
  } catch {
    return [];
  }
}

export const MERGE_RULE = `**Merge, don't clobber.** For any target file that already exists, do not overwrite silently — show a diff and ask the user whether to overwrite, keep theirs, or merge. Merge JSON settings field-by-field. Append AGENTS.md content under a delimited section. Install pi packages with \`pi install -l\` (project-local) only after confirming with the user; do NOT pre-add packages to ./.pi/settings.json by hand — \`pi install -l\` registers them on success (and leaves settings untouched on failure).`;

export const USER_INVOLVEMENT_RULE = `**The user is in the loop for every decision.** pi-distro is a collaborative, agent-driven tool — never make a state-changing decision for the user. Before overwriting a file, installing a package, skipping a step, replacing a tool, applying an upgrade, or resolving any conflict (merge, redundancy, version downgrade, etc.), the agent must (1) surface the decision clearly (what it's about to do and why), (2) present the available options, and (3) wait for the user's explicit choice. Never silently skip, silently overwrite, silently substitute, or proceed on assumption. If a decision is ambiguous or the user is unsure, explain the tradeoffs and let them choose. The agent proposes; the user disposes.`;

export const PACKAGE_CONFLICT_RULE = `**Evaluate tool redundancy/conflicts before installing.** When you install a distro's packages, some may provide tools that overlap with already-active tools — either an **exact name collision** (two tools with the same name) or **semantic redundancy** (different names, but doing very similar things, e.g. two web-search tools, two browser tools, two todo tools). pi handles exact name collisions by load order (project-local tools shadow global ones; the conflict is a non-fatal diagnostic, not a fatal error — pi still starts), but redundancy leaves the user with duplicate capability and a confusing tool set. Before installing each package, the **agent must evaluate** whether its purpose overlaps an already-active tool (read the already-active tools and project packages above, and run \`pi list\` to see globally-installed packages). If redundancy or a conflict is detected, do NOT install blindly — present the user a choice: (a) **skip** installing it (the capability already exists); (b) **replace** — \`pi remove -l <old>\` the overlapping package then \`pi install -l <new>\`; (c) **keep both** — install it anyway (e.g. the user prefers the new tool, or they serve subtly different purposes); (d) **cancel**. Only proceed with the user's choice.`;
