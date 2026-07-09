/**
 * `/pi-distro update` — upgrade the applied distro if a newer version exists.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { parseProvenance } from "./catalogue.ts";
import type { HarnessEntry } from "./catalogue.ts";
import { parseGithubRef, fetchGithubDistro } from "./github.ts";
import { resolveCatalogueEntry } from "./resolve.ts";
import { buildShowPreview } from "./show.ts";
import { sendDeployKickoff } from "./deploy.ts";
import { display, compareVersions } from "./util.ts";

export async function handleUpdate(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  // 1. Read provenance to find the applied distro.
  const snapshot = ctx.getSystemPromptOptions();
  const cwd = snapshot.cwd;
  const provenancePath = join(cwd, ".pi", "harness.md");
  if (!existsSync(provenancePath)) {
    ctx.ui.notify("No distro applied in this project. Run /pi-distro deploy <name> first.", "warning");
    return;
  }
  const prov = parseProvenance(readFileSync(provenancePath, "utf-8"));
  if (!prov) {
    ctx.ui.notify("Could not parse provenance in .pi/harness.md.", "error");
    return;
  }

  // 2. Resolve the current version from the source.
  const source = prov.sourceCatalogue;
  let current: HarnessEntry | undefined;
  let fetchedCleanup: (() => void) | undefined;

  if (source.startsWith("github:")) {
    // GitHub source: re-fetch to get the latest.
    const refStr = source.slice("github:".length);
    const ref = parseGithubRef(refStr);
    if (!ref) {
      ctx.ui.notify(`Could not parse GitHub source '${refStr}' from provenance.`, "error");
      return;
    }
    ctx.ui.notify(`Fetching ${ref.displayRef} from GitHub to check for updates…`, "info");
    try {
      const fetched = fetchGithubDistro(ref);
      current = fetched.entry;
      fetchedCleanup = fetched.cleanup;
    } catch (err) {
      ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
      return;
    }
  } else {
    // Local catalogue (seed or user).
    current = await resolveCatalogueEntry(prov.appliedHarness);
    if (!current) {
      ctx.ui.notify(
        `Distro '${prov.appliedHarness}' is no longer in the catalogue (it may have been removed or renamed). Applied version was v${prov.appliedVersion}.`,
        "warning",
      );
      return;
    }
  }

  // 3. Compare versions.
  const cmp = compareVersions(current.version, prov.appliedVersion);
  if (cmp === 0) {
    if (fetchedCleanup) fetchedCleanup();
    ctx.ui.notify(
      `Already up to date: ${prov.appliedHarness} v${prov.appliedVersion}. To force a re-deploy, run /pi-distro deploy ${prov.appliedHarness}.`,
      "info",
    );
    return;
  }

  const direction = cmp > 0 ? "upgrade" : "downgrade";
  if (direction === "downgrade") {
    if (fetchedCleanup) fetchedCleanup();
    ctx.ui.notify(
      `Downgrade warning: ${prov.appliedHarness} is at v${prov.appliedVersion} in this project, but the catalogue has v${current.version} (older). Updates are for moving to a newer version. To downgrade, run /pi-distro deploy ${prov.appliedHarness} and confirm.`,
      "warning",
    );
    return;
  }

  // 4. Upgrade available — surface it and ask the user before proceeding.
  const preview = await buildShowPreview(current);
  display(pi, `## Update available

${preview}`);

  const confirmed = await ctx.ui.confirm(
    "Apply the update?",
    `An update is available for ${prov.appliedHarness}: v${prov.appliedVersion} → v${current!.version}. This will re-deploy the distro (merge-don't-clobber; your existing config and customisations are preserved). Proceed?`,
  );
  if (!confirmed) {
    if (fetchedCleanup) fetchedCleanup();
    ctx.ui.notify("Update cancelled.", "info");
    return;
  }

  // 5. Run the standard deploy (carries the version note, merge rule, user-involvement rule, etc.).
  await sendDeployKickoff(pi, ctx, current!);
  // GitHub temp dir left in /tmp for the agent to read bundled files (ephemeral).
}
