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
import { readProjectPackages, USER_INVOLVEMENT_RULE } from "./util.ts";

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

  // Read current project state to compare against the distro's directives.
  const installedPackages = readProjectPackages(cwd);

  // Which of the distro's packages are still installed?
  const distroPackagesInstalled = packages.filter((p) => installedPackages.includes(p));
  const distroPackagesMissing = packages.filter((p) => !installedPackages.includes(p));

  // Check for the AGENTS.md delimited section.
  const agentsMdPath = join(cwd, "AGENTS.md");
  let agentsMdSection = "not present";
  if (existsSync(agentsMdPath)) {
    const content = readFileSync(agentsMdPath, "utf-8");
    if (content.includes(`<!-- pi-distro: ${prov.appliedHarness} -->`)) {
      agentsMdSection = "present";
    } else {
      agentsMdSection = "not found (already removed or never added)";
    }
  }

  const activeTools = snapshot.selectedTools?.length
    ? snapshot.selectedTools.map((t) => `- \`${t}\``).join("\n")
    : "_(none / default set)_";

  const packageList = distroPackagesInstalled.length > 0
    ? distroPackagesInstalled.map((p) => `- \`${p}\` — installed (can be removed with \`pi remove -l\`)`).join("\n")
    : "_(none of the distro's packages are currently installed)_";
  const missingNote = distroPackagesMissing.length > 0
    ? `\n\n**Packages from this distro not currently installed (already removed):**\n${distroPackagesMissing.map((p) => `- \`${p}\``).join("\n")}`
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
**Distro packages still installed in this project (${distroPackagesInstalled.length} of ${packages.length}):**
${packageList}${missingNote}

**AGENTS.md delimited section:** ${agentsMdSection}

**Active tools in this session:**
${activeTools}

**Installed packages in .pi/settings.json:**
${installedPackages.length > 0 ? installedPackages.map((p) => `- \`${p}\``).join("\n") : "_(none)_"}

### Removal procedure (follow exactly, collaborating with the user)

**0. User involvement rule** — ${USER_INVOLVEMENT_RULE} This is especially critical here:
removal is destructive. Never silently delete a file, remove a package, or strip a settings
key. The user may have customized files after deploy, or may want to keep some components.

**1. Walk the user through each removal category, one at a time:**

   **(a) Packages** — for each distro package still installed, offer to remove it with
   \`pi remove -l <pkg>\`. **Ask per package** — the user may want to keep some. Warn if
   removing a package that other components depend on (e.g. if an extension relies on a
   package's theme). If the user skips a package, note it.

   **(b) Bundled files** — the directives list bundled files (e.g. \`AGENTS.md\`,
   \`settings.json\`, \`extensions/claude-statusline.ts\`). For each, check if the file exists
   in the project. If it does, **show the user the file (or a summary) before removing** —
   they may have customized it and want to keep it. Offer: remove / keep. Never silently
   delete. For \`settings.json\`, offer to remove specific keys the distro merged (e.g.
   \`theme\`, \`defaultThinkingLevel\`) rather than deleting the whole file — and warn about
   user customizations.

   **(c) AGENTS.md delimited section** — if the \`<!-- pi-distro: ${prov.appliedHarness} -->\` ...
   \`<!-- /pi-distro: ${prov.appliedHarness} -->\` block exists, offer to remove it. If the
   user has a standalone (non-delimited) AGENTS.md that wasn't added by the distro, leave it.

   **(d) Extensions / skills / prompts / themes** — if the directives describe these and they
   exist in the project, offer to remove each (with the same show-before-delete rule).

**2. Remove provenance last.** Only after the user has confirmed the component removals,
   remove \`./.pi/harness.md\` (the provenance file). Confirm with the user before deleting it.

**3. Report and recommend a restart.** Summarise what was removed and what was kept (the user
   may have chosen to keep some components). Tell the user to **restart pi** — removed packages
   and extensions won't fully unload until the next session start.`);
}
