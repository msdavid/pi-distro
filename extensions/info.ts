/**
 * Read-only / catalogue-management commands:
 * `/pi-distro list`, `/pi-distro status`, `/pi-distro remove`.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  readCatalogue,
  findHarness,
  parseProvenance,
  getUserHarnessesDir,
  sourceLabel,
} from "./catalogue.ts";
import { resolveCatalogueEntry } from "./resolve.ts";
import {
  isOfficialSource,
  officialNameFromSource,
  listOfficialDistros,
  isOfficialCatalogueUnavailable,
} from "./github.ts";
import { display, compareVersions, readProjectPackages, readGlobalPackages } from "./util.ts";

// --- list ---

export async function handleList(pi: ExtensionAPI): Promise<void> {
  const catalogue = await readCatalogue();
  const offlineNote = isOfficialCatalogueUnavailable()
    ? "\n\n⚠️ Official distros could not be fetched from GitHub (offline or rate-limited?) — showing local distros only. Try again later."
    : "";
  if (catalogue.length === 0) {
    display(pi, `No distros found in the catalogue.${offlineNote}`);
    return;
  }
  const rows = catalogue.map((h) => {
    const desc = h.description.length > 50 ? h.description.slice(0, 47) + "..." : h.description;
    return `| ${h.name} | ${h.title} | ${h.version} | ${sourceLabel(h.source)} | ${desc} |`;
  });
  const officialCount = catalogue.filter((h) => isOfficialSource(h.source)).length;
  const localCount = catalogue.filter((h) => h.source === "user").length;
  const otherGhCount = catalogue.length - officialCount - localCount;
  display(pi, `## Distro catalogue

| NAME | TITLE | VERSION | SOURCE | DESCRIPTION |
|------|-------|---------|--------|-------------|
${rows.join("\n")}

_Official: ${officialCount} (GitHub) · Local: ${localCount}${otherGhCount > 0 ? ` · Other GitHub: ${otherGhCount}` : ""} · Total: ${catalogue.length}_${offlineNote}`);
}

// --- status ---

export async function handleStatus(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  const snapshot = ctx.getSystemPromptOptions();
  const cwd = snapshot.cwd;
  const provenancePath = join(cwd, ".pi", "harness.md");

  let provenanceSection: string;
  let updateSection = "";
  if (existsSync(provenancePath)) {
    const prov = parseProvenance(readFileSync(provenancePath, "utf-8"));
    if (prov) {
      provenanceSection = `### Applied distro\n- **Name:** ${prov.appliedHarness}\n- **Version:** ${prov.appliedVersion}\n- **Source:** ${sourceLabel(prov.sourceCatalogue)}\n- **Last updated:** ${prov.lastUpdated}`;
      // Check for updates.
      if (isOfficialSource(prov.sourceCatalogue)) {
        // Official: cheap version check via the cached GitHub listing (no clone).
        const officialName = officialNameFromSource(prov.sourceCatalogue);
        const current = (await listOfficialDistros()).find((h) => h.name === officialName);
        if (current) {
          const cmp = compareVersions(current.version, prov.appliedVersion);
          if (cmp > 0) {
            updateSection = `### Update available\n**${prov.appliedHarness}** v${prov.appliedVersion} → v${current.version}. Run \`/pi-distro update\` to apply.`;
          } else if (cmp < 0) {
            updateSection = `### Version note\nApplied v${prov.appliedVersion} is newer than the official catalogue's v${current.version} (downgrade).`;
          } // same version → no section
        } else if (isOfficialCatalogueUnavailable()) {
          updateSection = `### Update check\nCould not check for updates: the official catalogue is unreachable (offline or GitHub rate limit?). Try again later.`;
        } else {
          updateSection = `### Update check\nOfficial distro '${prov.appliedHarness}' is no longer in the catalogue (removed or renamed).`;
        }
      } else if (!prov.sourceCatalogue.startsWith("github:")) {
        // Local (user) catalogue.
        const current = await resolveCatalogueEntry(prov.appliedHarness);
        if (current) {
          const cmp = compareVersions(current.version, prov.appliedVersion);
          if (cmp > 0) {
            updateSection = `### Update available\n**${prov.appliedHarness}** v${prov.appliedVersion} → v${current.version}. Run \`/pi-distro update\` to apply.`;
          } else if (cmp < 0) {
            updateSection = `### Version note\nApplied v${prov.appliedVersion} is newer than the catalogue's v${current.version} (downgrade).`;
          } // same version → no section
        } else {
          updateSection = `### Update check\nDistro '${prov.appliedHarness}' is no longer in the catalogue (removed or renamed).`;
        }
      } else {
        updateSection = `### Update check\nApplied from GitHub (\`${prov.sourceCatalogue}\`). Run \`/pi-distro update\` to fetch the latest and check for updates.`;
      }
    } else {
      provenanceSection = "### Applied distro\nA provenance file exists but could not be parsed.";
    }
  } else {
    provenanceSection = "### Applied distro\nNo distro provenance found in this project.";
  }

  const tools = snapshot.selectedTools?.join(", ") ?? "(default)";
  const skillsList = snapshot.skills?.map((s) => `- ${s.name}`).join("\n") ?? "_(none)_";
  const contextList = snapshot.contextFiles?.map((c) => `- ${c.path}`).join("\n") ?? "_(none)_";

  const lpkgs = readProjectPackages(cwd);
  const localPackages = lpkgs.length > 0 ? lpkgs.map((p) => `- \`${p}\``).join("\n") : "_(none)_";
  const gpkgs = readGlobalPackages();
  const globalPackages = gpkgs.length > 0 ? gpkgs.map((p) => `- \`${p}\``).join("\n") : "_(none)_";

  display(pi, `## Project distro status

${provenanceSection}
${updateSection}
### Live configuration
- **Working dir:** ${cwd}
- **Active tools:** ${tools}
- **Skills:**
${skillsList}
- **Context files:**
${contextList}
- **Installed packages (project-local, ./.pi/settings.json):**
${localPackages}
- **Installed packages (global, ~/.pi/agent/settings.json):**
${globalPackages}`);
}

// --- remove ---

export async function handleRemove(pi: ExtensionAPI, ctx: ExtensionCommandContext, name?: string): Promise<void> {
  if (!name) { ctx.ui.notify("Usage: /pi-distro remove <name>", "error"); return; }
  const catalogue = await readCatalogue();
  const harness = findHarness(name, catalogue);
  if (!harness) {
    const available = catalogue.map((h) => h.name).join(", ") || "(none)";
    ctx.ui.notify(`Distro '${name}' not found. Available: ${available}`, "error");
    return;
  }
  if (harness.source.startsWith("github:")) {
    ctx.ui.notify(`'${name}' is a GitHub distro (${sourceLabel(harness.source)}) and cannot be removed locally. Only user-saved distros in ~/.pi/harnesses/ can be removed.`, "error");
    return;
  }
  const confirmed = await ctx.ui.confirm("Remove harness?", `This deletes '~/.pi/harnesses/${name}/'. A backup will be saved to .trash/.`);
  if (!confirmed) return;

  // Back up to .trash, then delete
  const userDir = getUserHarnessesDir();
  const trashDir = join(userDir, ".trash", `${name}-${Date.now()}`);
  mkdirSync(trashDir, { recursive: true });
  cpSync(harness.dir!, join(trashDir, name), { recursive: true });
  rmSync(harness.dir!, { recursive: true, force: true });
  ctx.ui.notify(`Removed distro '${name}'. (Backup in ~/.pi/harnesses/.trash/)`, "info");
}
