/**
 * `/pi-distro pick` — partial deploy: select which components to apply from a distro.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { listBundledFiles, parsePackageListWithScope } from "./catalogue.ts";
import { extractBody } from "./frontmatter.ts";
import { parseGithubRef, isOfficialSource, tempCloneRoot } from "./github.ts";
import { resolveDistro } from "./resolve.ts";
import { buildShowPreview } from "./show.ts";
import {
  display,
  readProjectPackages,
  readGlobalPackages,
  MERGE_RULE,
  SCOPE_RULE,
  USER_INVOLVEMENT_RULE,
  PACKAGE_CONFLICT_RULE,
} from "./util.ts";

export async function handlePick(pi: ExtensionAPI, ctx: ExtensionCommandContext, nameArg?: string): Promise<void> {
  const resolved = await resolveDistro(pi, ctx, nameArg, "pick from");
  if (!resolved) return;
  const { entry, cleanup } = resolved;

  // GitHub trust gate — official distros are trusted and skip the warning;
  // other GitHub refs require explicit user confirmation.
  if (cleanup && !isOfficialSource(entry.source)) {
    const ref = parseGithubRef(nameArg!)!;
    const preview = await buildShowPreview(entry);
    const warning = `\n\n---\n\n⚠️ **Security warning:** This distro was fetched from \`${ref.displayRef}\` on GitHub. Picking components from an unknown distro is still **dangerous** — packages can execute code, extensions run at startup, and directives inject agent instructions. Review everything above carefully. You are responsible for what you install.`;
    display(pi, preview + warning);
    const confirmed = await ctx.ui.confirm(
      "Pick from GitHub distro?",
      `You're about to pick components from \`${entry.name}\` (\`${ref.displayRef}\`). Review the preview above and confirm to proceed to selection.`,
    );
    if (!confirmed) {
      cleanup();
      ctx.ui.notify("Pick cancelled.", "info");
      return;
    }
  }

  // Parse the distro into selectable components.
  const fullMd = readFileSync(entry.harnessMdPath!, "utf-8");
  const directives = extractBody(fullMd);
  const packages = parsePackageListWithScope(directives);
  const files = entry.filesDir ? await listBundledFiles(entry.filesDir) : [];
  const cloneRoot = entry.dir ? tempCloneRoot(entry.dir) : undefined;
  const cloneCleanupNote = cloneRoot
    ? `\n\nThe distro was fetched to a temporary GitHub clone. After the selected bundled files have been copied into the project, remove the clone: \`rm -rf ${cloneRoot}\``
    : "";
  const filesDirNote = (entry.filesDir ? `\n\nBundled files are located at: \`${entry.filesDir}\`` : "") + cloneCleanupNote;

  const snapshot = ctx.getSystemPromptOptions();
  const activeTools = snapshot.selectedTools?.length
    ? snapshot.selectedTools.map((t) => `- \`${t}\``).join("\n")
    : "_(none / default set)_";
  const pkgs = readProjectPackages(snapshot.cwd);
  const projectPackages = pkgs.length > 0 ? pkgs.map((p) => `- \`${p}\``).join("\n") : "_(none)_";
  const gpkgs = readGlobalPackages();
  const globalPackages = gpkgs.length > 0 ? gpkgs.map((p) => `- \`${p}\``).join("\n") : "_(none)_";

  const packageList = packages.length > 0
    ? packages.map((p) => `- \`${p.source}\` [${p.scope}]`).join("\n")
    : "_(none)_";
  const fileList = files.length > 0
    ? files.map((f) => `- \`${f.source}\` → \`./${f.target}\``).join("\n")
    : "_(none)_";

  pi.sendUserMessage(`## Picking components from distro: ${entry.name} (v${entry.version})

This is a **partial deploy**. The user wants to select which components to apply from this
distro — not the whole thing. Walk them through the selection, then apply only what they
choose. This lets users combine pieces from different distros to build their own config.

### Directives (full — for your reference on what each component does)
${directives}

### Selectable components
**📦 Packages (${packages.length}):**
${packageList}

**📄 Bundled files (${files.length}):**
${fileList}${filesDirNote}

The directives body above may also describe other components (settings keys, context,
extensions, themes, prompts, skills) — treat each as individually selectable too.

### Current project state (for conflict detection)
**Already-active tools in this session:**
${activeTools}

**Packages already in this project's .pi/settings.json (project-local):**
${projectPackages}

**Packages already in ~/.pi/agent/settings.json (global, every project):**
${globalPackages}

(Run \`pi list\` to see both local and global packages in one view.)

### Selection procedure (follow exactly, collaborating with the user)

**0. User involvement rule** — ${USER_INVOLVEMENT_RULE}

**0a. Scope rule** — ${SCOPE_RULE} Apply the deployment-plan + preset flow to the items the user selects to apply (not the whole distro). Build the plan from only the selected components, offer the three presets (accept-defaults / all-global-where-safe / customize), apply the scope-safety guard for dangerous types, then install/place at the chosen scope.

**1. Walk the user through each category, one at a time.** For each category (packages, then
   bundled files, then any other components described in the directives), use
   \`ctx.ui.select\`/\`ctx.ui.confirm\` to let the user pick which to apply. Present the items
   with their one-line purpose (from the directives) and their author scope hint
   (\`[local]\`/\`[global]\`). Let the user select any subset —
   including none (skip the category entirely).

**2. Surface dependencies.** As the user selects, **evaluate cross-component dependencies**
   and warn about them before applying. For example: if the user picks the
   \`claude-statusline.ts\` extension but skips \`pi-crew\`, point out that the statusline
   references a theme provided by pi-crew and will error without it — ask whether to also
   install pi-crew or skip the statusline. The directives prose is your source for these
   relationships; reason about them and explain the tradeoffs to the user. Never silently
   install a dependency the user didn't pick — always ask.

**3. Apply only the selected components**, with the same rules as a full deploy:
   - **Merge-don't-clobber** — ${MERGE_RULE}
   - **Package-redundancy check** — ${PACKAGE_CONFLICT_RULE}
   - For each selected package: install at the chosen scope (\`pi install -l\` for local, \`pi install\` for global) after confirming (do NOT pre-add to
     settings.json by hand).
   - For each selected bundled file: copy/merge as the user chooses (overwrite / keep theirs /
     merge).

**4. Do NOT write standard provenance.** A partial deploy is not "this distro was applied" —
   it's a custom configuration built from pieces. Do not write or update \`./.pi/harness.md\`
   with \`appliedHarness\`/\`appliedVersion\` provenance for a partial deploy. Instead, after
   applying the selected components, **suggest the next step**: tell the user "This is a
   custom configuration. Run \`/pi-distro save\` to snapshot it as your own reusable distro"
   (which will then write clean provenance for the saved distro).

**5. Recommend a restart** if any packages or extensions were installed — they load at
   startup.`);
  // GitHub temp dir is left in place so the agent can read the bundled files;
  // the kickoff instructs the agent to remove it after copying them.
}
