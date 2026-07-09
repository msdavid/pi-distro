/**
 * Distro resolution: turn a name argument (GitHub ref or local catalogue name,
 * or an interactive selector) into a HarnessEntry.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  readCatalogue,
  findHarness,
} from "./catalogue.ts";
import type { HarnessEntry } from "./catalogue.ts";
import { looksLikeGithubRef, parseGithubRef, fetchGithubDistro } from "./github.ts";

/**
 * Resolve a distro from a name argument (GitHub ref or local catalogue name).
 * If nameArg is omitted, shows the interactive selector.
 * Returns { entry, cleanup? } or undefined on cancel/error (notifies the user on error).
 * `cleanup` is present only for GitHub distros (to remove the temp clone).
 */
export async function resolveDistro(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  nameArg: string | undefined,
  verb: string,
): Promise<{ entry: HarnessEntry; cleanup?: () => void } | undefined> {
  // GitHub ref? (contains a /)
  if (nameArg && looksLikeGithubRef(nameArg)) {
    const ref = parseGithubRef(nameArg)!;
    ctx.ui.notify(`Fetching ${ref.displayRef} from GitHub…`, "info");
    try {
      const fetched = fetchGithubDistro(ref);
      return { entry: fetched.entry, cleanup: fetched.cleanup };
    } catch (err) {
      ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
      return undefined;
    }
  }

  // Local catalogue
  const catalogue = await readCatalogue();
  if (catalogue.length === 0) {
    ctx.ui.notify("No distros found. Run /pi-distro save to create one.", "warning");
    return undefined;
  }
  if (nameArg) {
    const harness = findHarness(nameArg, catalogue);
    if (!harness) {
      const available = catalogue.map((h) => h.name).join(", ") || "(none)";
      ctx.ui.notify(`Distro '${nameArg}' not found. Available: ${available}`, "error");
      return undefined;
    }
    return { entry: harness };
  }
  // No nameArg → interactive selector
  const theme = ctx.ui.theme;
  const labels = catalogue.map((h) => `${theme.bold(h.name)} — ${h.description}`);
  const selected = await ctx.ui.select(`Select a distro to ${verb}:`, labels);
  if (selected === undefined) return undefined;
  const harness = catalogue[labels.indexOf(selected)];
  return harness ? { entry: harness } : undefined;
}

/** Resolve the current catalogue entry for a distro by name (local catalogue only). */
export async function resolveCatalogueEntry(name: string): Promise<HarnessEntry | undefined> {
  const catalogue = await readCatalogue();
  return findHarness(name, catalogue);
}
