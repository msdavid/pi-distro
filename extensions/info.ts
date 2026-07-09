/**
 * Read-only / catalogue-management commands:
 * `/pi-distro list`, `/pi-distro status`, `/pi-distro remove`.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync, readdirSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  readCatalogue,
  findHarness,
  parseProvenance,
  getUserHarnessesDir,
} from "./catalogue.ts";
import { resolveCatalogueEntry } from "./resolve.ts";
import { display, compareVersions } from "./util.ts";

// --- list ---

export async function handleList(pi: ExtensionAPI): Promise<void> {
  const catalogue = await readCatalogue();
  if (catalogue.length === 0) { display(pi, "No distros found in the catalogue."); return; }
  const rows = catalogue.map((h) => {
    const desc = h.description.length > 50 ? h.description.slice(0, 47) + "..." : h.description;
    return `| ${h.name} | ${h.title} | ${h.version} | ${h.source} | ${desc} |`;
  });
  const seedCount = catalogue.filter((h) => h.source === "seed").length;
  const userCount = catalogue.filter((h) => h.source === "user").length;
  display(pi, `## Distro catalogue

| NAME | TITLE | VERSION | SOURCE | DESCRIPTION |
|------|-------|---------|--------|-------------|
${rows.join("\n")}

_Seeds: ${seedCount} · User: ${userCount} · Total: ${catalogue.length}_`);
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
      provenanceSection = `### Applied distro\n- **Name:** ${prov.appliedHarness}\n- **Version:** ${prov.appliedVersion}\n- **Source:** ${prov.sourceCatalogue}\n- **Last updated:** ${prov.lastUpdated}`;
      // Check for updates (local catalogue only; GitHub sources are not auto-fetched on status).
      if (!prov.sourceCatalogue.startsWith("github:")) {
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

  let packages = "_(none)_";
  const settingsPath = join(cwd, ".pi", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (Array.isArray(settings.packages) && settings.packages.length > 0) {
        packages = settings.packages.map((p: string) => `- \`${p}\``).join("\n");
      }
    } catch { /* ignore */ }
  }

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
- **Installed packages:**
${packages}`);
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
  if (harness.source === "seed") {
    ctx.ui.notify(`'${name}' is a package seed and cannot be removed.`, "error");
    return;
  }
  const confirmed = await ctx.ui.confirm("Remove harness?", `This deletes '~/.pi/harnesses/${name}/'. A backup will be saved to .trash/.`);
  if (!confirmed) return;

  // Back up to .trash, then delete
  const userDir = getUserHarnessesDir();
  const trashDir = join(userDir, ".trash", `${name}-${Date.now()}`);
  mkdirSync(trashDir, { recursive: true });
  cpSync(harness.dir, join(trashDir, name), { recursive: true });
  rmSync(harness.dir, { recursive: true, force: true });
  ctx.ui.notify(`Removed distro '${name}'. (Backup in ~/.pi/harnesses/.trash/)`, "info");
}
