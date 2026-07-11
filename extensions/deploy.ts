/**
 * `/pi-distro deploy` — apply a distro (local name or GitHub ref) to the project.
 * sendDeployKickoff() is also reused by `/pi-distro update`.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { listBundledFiles, parseProvenance } from "./catalogue.ts";
import type { HarnessEntry } from "./catalogue.ts";
import { extractBody } from "./frontmatter.ts";
import { parseGithubRef, isOfficialSource } from "./github.ts";
import { resolveDistro } from "./resolve.ts";
import { buildShowPreview } from "./show.ts";
import {
  display,
  compareVersions,
  readProjectPackages,
  MERGE_RULE,
  USER_INVOLVEMENT_RULE,
  PACKAGE_CONFLICT_RULE,
} from "./util.ts";

/** Build and send the deploy kickoff message for a resolved harness. */
export async function sendDeployKickoff(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  harness: HarnessEntry,
): Promise<void> {
  const body = readFileSync(harness.harnessMdPath!, "utf-8");
  const directives = extractBody(body);
  const files = harness.filesDir ? await listBundledFiles(harness.filesDir) : [];
  const fileList = files.length > 0
    ? files.map((f) => `- \`${f.source}\` → \`./${f.target}\``).join("\n")
    : "_(no bundled files)_";
  const filesDirNote = harness.filesDir ? `\n\nBundled files are located at: \`${harness.filesDir}\`` : "";

  const snapshot = ctx.getSystemPromptOptions();
  const activeTools = snapshot.selectedTools?.length
    ? snapshot.selectedTools.map((t) => `- \`${t}\``).join("\n")
    : "_(none / default set)_";
  const pkgs = readProjectPackages(snapshot.cwd);
  const projectPackages = pkgs.length > 0 ? pkgs.map((p) => `- \`${p}\``).join("\n") : "_(none)_";

  // Version comparison against existing provenance (upgrade / downgrade / same / first deploy)
  const provenancePath = join(snapshot.cwd, ".pi", "harness.md");
  let versionNote = "";
  if (existsSync(provenancePath)) {
    const prov = parseProvenance(readFileSync(provenancePath, "utf-8"));
    if (prov) {
      if (prov.appliedHarness !== harness.name) {
        versionNote = `### Version note\nThis project currently has distro **${prov.appliedHarness}** (v${prov.appliedVersion}) applied. You are now deploying **${harness.name}** (v${harness.version}) — a different distro. The agent should treat this as a distro switch (merge with existing config; do not assume the new distro's files are a superset of the old).`;
      } else {
        const cmp = compareVersions(harness.version, prov.appliedVersion);
        if (cmp > 0) {
          versionNote = `### Version note\n**Upgrading** ${prov.appliedHarness}: v${prov.appliedVersion} → v${harness.version}. Re-apply the distro (merge-don't-clobber still applies — existing user customisations should be preserved).`;
        } else if (cmp < 0) {
          versionNote = `### Version note\n**Downgrade warning:** the project has v${prov.appliedVersion} of ${harness.name} applied, but you are deploying v${harness.version} (an older version). Ask the user to confirm before proceeding — this may remove features or regress fixes. If they confirm, proceed with merge-don't-clobber.`;
        } else {
          versionNote = `### Version note\n**Same version** (v${harness.version}) is already applied. Ask the user whether to (a) skip (no changes — the project already has this exact distro) or (b) force re-deploy (re-run the merge, useful if files were manually edited or the distro was updated in-place). Only proceed if they choose (b).`;
        }
      }
    }
  } else {
    versionNote = `### Version note\nFirst deploy of distro **${harness.name}** (v${harness.version}) in this project — no existing provenance found.`;
  }

  pi.sendUserMessage(`## Deploying distro: ${harness.name} (v${harness.version})

### Directives
${directives}

### Bundled files manifest
${fileList}${filesDirNote}

### Current project state (for conflict detection)
**Already-active tools in this session:**
${activeTools}

**Packages already in this project's .pi/settings.json:**
${projectPackages}

(Run \`pi list\` to also see globally-installed packages.)

${versionNote}

### User involvement rule
${USER_INVOLVEMENT_RULE}

### Merge rule
${MERGE_RULE}

### Package-conflict rule
${PACKAGE_CONFLICT_RULE}

### Provenance
When finished, write or update \`./.pi/harness.md\` provenance with:
\`\`\`
<!-- pi-distro provenance
     appliedHarness: ${harness.name}
     appliedVersion: ${harness.version}
     sourceCatalogue: ${harness.source}
     lastUpdated: ${new Date().toISOString()}
-->
\`\`\`
Place this provenance header at the top of the body, followed by the harness.md directives.

### Post-deploy
After all files are placed, packages installed, and provenance written, tell the user:
"Distro **${harness.name}** deployed. **Restart pi** to activate newly-installed packages and extensions." A restart is required because pi loads extensions and packages at startup — newly installed ones are not available until the next session start.`);
}

export async function handleDeploy(pi: ExtensionAPI, ctx: ExtensionCommandContext, nameArg?: string): Promise<void> {
  const resolved = await resolveDistro(pi, ctx, nameArg, "deploy");
  if (!resolved) return;
  const { entry, cleanup } = resolved;

  // GitHub trust gate — official distros (msdavid/pi-distro) are trusted and skip
  // the warning; other GitHub refs require explicit user confirmation.
  if (cleanup && !isOfficialSource(entry.source)) {
    const ref = parseGithubRef(nameArg!)!;
    const preview = await buildShowPreview(entry);
    const warning = `\n\n---\n\n⚠️ **Security warning:** This distro was fetched from \`${ref.displayRef}\` on GitHub. Installing unknown distros is **dangerous** — they can install arbitrary packages, write extensions that execute code, and inject agent instructions. Review everything above carefully before proceeding. You are responsible for what you install.`;
    display(pi, preview + warning);
    const confirmed = await ctx.ui.confirm(
      "Deploy from GitHub?",
      `This will install the distro \`${entry.name}\` from \`${ref.displayRef}\`. It may install packages and write files to your project. Only proceed if you trust this source and have reviewed the preview above.`,
    );
    if (!confirmed) {
      cleanup();
      ctx.ui.notify("Deploy cancelled.", "info");
      return;
    }
  }

  await sendDeployKickoff(pi, ctx, entry);
  // GitHub temp dir left in /tmp for the agent to read bundled files (ephemeral).
}
