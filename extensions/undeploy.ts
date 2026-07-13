/**
 * `/pi-distro undeploy` — remove an applied distro from the current project
 * (the reverse of deploy).
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { parseProvenance, parsePackageList } from "./catalogue.ts";
import { extractBody } from "./frontmatter.ts";
import { readProjectPackages, readGlobalPackages, USER_INVOLVEMENT_RULE } from "./util.ts";
import { homedir } from "node:os";

export async function handleUndeploy(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const snapshot = ctx.getSystemPromptOptions();
  const cwd = snapshot.cwd;
  const provenancePath = join(cwd, ".pi", "harness.md");
  if (!existsSync(provenancePath)) {
    ctx.ui.notify("No distro applied in this project. (Nothing to undeploy.)", "warning");
    return;
  }
  const provContent = readFileSync(provenancePath, "utf-8");
  const prov = parseProvenance(provContent);
  if (!prov) {
    ctx.ui.notify("Could not parse provenance in .pi/harness.md.", "error");
    return;
  }

  // The provenance file contains the full directives body (after the provenance header).
  // Reuse it to identify what the distro intended to install.
  const directives = extractBody(provContent);
  const packages = parsePackageList(directives);

  // Read current project state to compare against the distro's directives. A distro may
  // have installed packages/files either project-locally or globally — provenance records
  // the directives (intentions), not scope, so we detect placement at runtime by checking
  // BOTH ./.pi/settings.json and ~/.pi/agent/settings.json (and both file trees).
  const installedLocal = readProjectPackages(cwd);
  const installedGlobal = readGlobalPackages();

  // Classify each distro package by where it actually landed.
  type Placement = "local" | "global" | "both" | "missing";
  const placement = (src: string): Placement => {
    const inLocal = installedLocal.includes(src);
    const inGlobal = installedGlobal.includes(src);
    if (inLocal && inGlobal) return "both";
    if (inLocal) return "local";
    if (inGlobal) return "global";
    return "missing";
  };
  const removeHint = (pl: Placement): string =>
    pl === "local" ? "remove with `pi remove -l <pkg>`"
    : pl === "global" ? "remove with `pi remove <pkg>` (global — affects every project)"
    : pl === "both" ? "remove from both: `pi remove -l <pkg>` AND `pi remove <pkg>`"
    : "";
  const distroPackages = packages.map((p) => ({ pkg: p, pl: placement(p) }));
  const distroPackagesInstalled = distroPackages.filter((d) => d.pl !== "missing");
  const distroPackagesMissing = distroPackages.filter((d) => d.pl === "missing");

  // Check for the AGENTS.md delimited section at BOTH the project root and the global
  // ~/.pi/agent/AGENTS.md (a distro may have deployed it at either scope).
  const checkAgentsSection = (path: string): boolean => {
    if (!existsSync(path)) return false;
    return readFileSync(path, "utf-8").includes(`<!-- pi-distro: ${prov.appliedHarness} -->`);
  };
  const localAgentsMdPath = join(cwd, "AGENTS.md");
  const globalAgentsMdPath = join(homedir(), ".pi", "agent", "AGENTS.md");
  const localAgentsPresent = checkAgentsSection(localAgentsMdPath);
  const globalAgentsPresent = checkAgentsSection(globalAgentsMdPath);
  let agentsMdSection: string;
  if (localAgentsPresent && globalAgentsPresent) agentsMdSection = "present in BOTH ./AGENTS.md and ~/.pi/agent/AGENTS.md";
  else if (localAgentsPresent) agentsMdSection = "present in ./AGENTS.md (project-local)";
  else if (globalAgentsPresent) agentsMdSection = "present in ~/.pi/agent/AGENTS.md (global — affects every session)";
  else agentsMdSection = "not found (already removed or never added)";

  const activeTools = snapshot.selectedTools?.length
    ? snapshot.selectedTools.map((t) => `- \`${t}\``).join("\n")
    : "_(none / default set)_";

  const packageList = distroPackagesInstalled.length > 0
    ? distroPackagesInstalled.map((d) => `- \`${d.pkg}\` — [${d.pl}] ${removeHint(d.pl)}`).join("\n")
    : "_(none of the distro's packages are currently installed)_";
  const missingNote = distroPackagesMissing.length > 0
    ? `\n\n**Packages from this distro not currently installed (already removed):**\n${distroPackagesMissing.map((d) => `- \`${d.pkg}\``).join("\n")}`
    : "";

  pi.sendUserMessage(`## Undeploying distro: ${prov.appliedHarness} (v${prov.appliedVersion})

The user wants to **remove** the applied distro from this project. This is the reverse of
\`/pi-distro deploy\`. Walk them through removing each component, asking at every step —
never silently delete anything. Provenance records the distro's *intentions* (directives),
not the exact outcome of the interactive deploy, so you must compare the directives against
the *current* project state and let the user decide what to remove.

### Distro directives (for reference — what was intended to be applied)
${directives}

### Current project state
**Distro packages still installed (${distroPackagesInstalled.length} of ${packages.length}; [local] = ./.pi, [global] = ~/.pi/agent, [both] = both):**
${packageList}${missingNote}

**AGENTS.md delimited section:** ${agentsMdSection}

**Active tools in this session:**
${activeTools}

**Installed packages in .pi/settings.json (project-local):**
${installedLocal.length > 0 ? installedLocal.map((p) => `- \`${p}\``).join("\n") : "_(none)_"}

**Installed packages in ~/.pi/agent/settings.json (global):**
${installedGlobal.length > 0 ? installedGlobal.map((p) => `- \`${p}\``).join("\n") : "_(none)_"}

### Removal procedure (follow exactly, collaborating with the user)

**0. User involvement rule** — ${USER_INVOLVEMENT_RULE} This is especially critical here:
removal is destructive. Never silently delete a file, remove a package, or strip a settings
key. The user may have customized files after deploy, or may want to keep some components.

**1. Walk the user through each removal category, one at a time:**

   **(a) Packages** — for each distro package still installed, remove it from wherever it
   was placed. Use the [placement] shown above: \`pi remove -l <pkg>\` for [local],
   \`pi remove <pkg>\` for [global] (note: global removal affects EVERY project on this
   machine — say so and get explicit confirmation), and BOTH commands for [both]. **Ask per
   package** — the user may want to keep some. Warn if removing a package that other
   components depend on (e.g. if an extension relies on a package's theme). If the user
   skips a package, note it.

   **(b) Bundled files** — the directives list bundled files (e.g. \`AGENTS.md\`,
   \`settings.json\`, \`extensions/claude-statusline.ts\`). A file may have been placed at
   EITHER scope: check for it at both \`./<path>\` (project-local) AND
   \`~/.pi/agent/<equivalent>\` (global). For each that exists, **show the user the file (or
   a summary) before removing** — they may have customized it and want to keep it. Offer:
   remove / keep, per location. Never silently delete. For \`settings.json\` (local at
   \`./.pi/settings.json\`, global at \`~/.pi/agent/settings.json\`), offer to remove specific
   keys the distro merged (e.g. \`theme\`, \`defaultThinkingLevel\`) rather than deleting the
   whole file — and warn about user customizations. Warn that global settings removal
   affects every project.

   **(c) AGENTS.md delimited section** — the \`<!-- pi-distro: ${prov.appliedHarness} -->\` ...
   \`<!-- /pi-distro: ${prov.appliedHarness} -->\` block may exist at \`./AGENTS.md\`
   (project-local) and/or \`~/.pi/agent/AGENTS.md\` (global). Offer to remove it from each
   location it was found (see the AGENTS.md status above). Warn that removing the global one
   affects every session. If the user has a standalone (non-delimited) AGENTS.md that wasn't
   added by the distro, leave it.

   **(d) Extensions / skills / prompts / themes** — if the directives describe these, check
   for them in BOTH \`./.pi/<type>/\` (local) and \`~/.pi/agent/<type>/\` (global). Offer to
   remove each (with the same show-before-delete rule), per location.

**2. Remove provenance last.** Only after the user has confirmed the component removals,
   remove \`./.pi/harness.md\` (the provenance file). Confirm with the user before deleting it.

**3. Report and recommend a restart.** Summarise what was removed and what was kept (the user
   may have chosen to keep some components). Tell the user to **restart pi** — removed packages
   and extensions won't fully unload until the next session start.`);
}
