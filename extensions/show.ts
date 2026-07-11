/**
 * `/pi-distro show` — dry-run preview of a distro (local or GitHub).
 * Also exports buildShowPreview(), reused by deploy/pick/update.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { readFullHarnessMd, listBundledFiles, readCatalogue, findHarness, parsePackageList, sourceLabel } from "./catalogue.ts";
import type { HarnessEntry } from "./catalogue.ts";
import { parseFrontmatter, extractBody } from "./frontmatter.ts";
import { looksLikeGithubRef, parseGithubRef, fetchGithubDistro, fetchOfficialDistro } from "./github.ts";
import { display } from "./util.ts";

/** Build the dry-run preview for a harness (used by local and GitHub show). */
export async function buildShowPreview(harness: HarnessEntry): Promise<string> {
  const fullMd = await readFullHarnessMd(harness.harnessMdPath!);
  const fm = parseFrontmatter(fullMd);
  const body = extractBody(fullMd);
  const packages = parsePackageList(body);

  let settingsPreview = "_(none)_";
  if (harness.filesDir) {
    const sp = join(harness.filesDir, "settings.json");
    if (existsSync(sp)) settingsPreview = "```json\n" + readFileSync(sp, "utf-8") + "\n```";
  }
  const files = harness.filesDir ? await listBundledFiles(harness.filesDir) : [];
  const fileList = files.length > 0
    ? files.map((f) => `- \`${f.source}\` → \`./${f.target}\``).join("\n")
    : "_(none)_";
  const tags = fm?.tags
    ? Array.isArray(fm.tags) ? fm.tags.join(", ") : String(fm.tags)
    : "_(none)_";

  return `## Distro preview: ${harness.name}

### Frontmatter
- **Name:** ${fm?.name ?? harness.name}
- **Title:** ${fm?.title ?? harness.title}
- **Description:** ${fm?.description ?? harness.description}
- **Version:** ${fm?.version ?? harness.version}
- **Tags:** ${tags}
- **Source:** ${sourceLabel(harness.source)}

### pi packages to install
${packages.length > 0 ? packages.map((p) => `- \`${p}\``).join("\n") : "_(none)_"}

### Settings (would be merged)
${settingsPreview}

### Bundled files (target paths)
${fileList}

### Full directives
${body}

---
Nothing is applied. Run \`/pi-distro deploy\` to apply.`;
}

export async function handleShow(pi: ExtensionAPI, name?: string): Promise<void> {
  if (!name) {
    display(pi, "Usage: \`/pi-distro show <name|gh-repo>\`\n\nExamples:\n  /pi-distro show minimal\n  /pi-distro show owner/repo\n  /pi-distro show owner/repo/subpath");
    return;
  }

  // GitHub ref?
  if (looksLikeGithubRef(name)) {
    const ref = parseGithubRef(name)!;
    pi.sendMessage({ customType: "pi-distro", content: `Fetching \`${ref.displayRef}\` from GitHub…`, display: true });
    let fetched;
    try {
      fetched = fetchGithubDistro(ref);
    } catch (err) {
      display(pi, `**Error:** ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      display(pi, await buildShowPreview(fetched.entry));
    } finally {
      fetched.cleanup();
    }
    return;
  }

  // Local catalogue (official distros appear here as needsFetch listing entries;
  // user distros are read straight from disk).
  const catalogue = await readCatalogue();
  const harness = findHarness(name, catalogue);
  if (!harness) {
    const available = catalogue.map((h) => h.name).join(", ") || "(none)";
    display(pi, `Distro '${name}' not found. Available: ${available}`);
    return;
  }
  // Official listing entry — fetch the actual distro from GitHub before previewing.
  if (harness.needsFetch) {
    let fetched;
    try {
      fetched = fetchOfficialDistro(harness.name);
    } catch (err) {
      display(pi, `**Error:** ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      display(pi, await buildShowPreview(fetched.entry));
    } finally {
      fetched.cleanup();
    }
    return;
  }
  display(pi, await buildShowPreview(harness));
}
