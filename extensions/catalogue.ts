/**
 * Catalogue reading logic for pi-distro.
 *
 * The effective catalogue is the union of:
 *   - **Official distros** — fetched dynamically from `msdavid/pi-distro`'s
 *     `harnesses/` directory on GitHub (no longer bundled in the npm package).
 *   - **User distros** — saved locally to `~/.pi/harnesses/`.
 * On a name collision, the user distro takes precedence (so a user can override
 * an official distro by saving one with the same name).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { parseFrontmatter, extractBody } from "./frontmatter.ts";
import { listOfficialDistros, isOfficialSource } from "./github.ts";

export interface HarnessEntry {
  name: string;
  title: string;
  description: string;
  version: string;
  source: string;  // "user", "github:owner/repo[/subpath]", or official "github:msdavid/pi-distro/harnesses/<name>"
  dir?: string;            // on-disk dir (user distros, or a fetched GitHub clone). Absent for official *listing* entries.
  harnessMdPath?: string;  // path to harness.md. Absent for official *listing* entries (fetched on selection).
  filesDir?: string;
  needsFetch?: boolean;    // true for official listing entries — must fetchGithubDistro before use
}

export interface BundledFile {
  source: string;
  target: string;
}

/** Parse pi package references (npm:...) from a directives body. */
export function parsePackageList(body: string): string[] {
  const packages: string[] = [];
  let inSection = false;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (/^##\s+pi\s*packages/i.test(t)) { inSection = true; continue; }
    if (inSection) {
      if (/^##\s/.test(t)) { inSection = false; continue; }
      const m = t.match(/^-\s+`(npm:[^`]+)`/);
      if (m) packages.push(m[1]);
    }
  }
  return packages;
}

export interface Provenance {
  appliedHarness: string;
  appliedVersion: string;
  sourceCatalogue: string;
  lastUpdated: string;
}

/** Parse the provenance header from a harness.md content. */
export function parseProvenance(content: string): Provenance | null {
  const m = content.match(
    /appliedHarness:\s*(.+?)\s*\n\s*appliedVersion:\s*(.+?)\s*\n\s*sourceCatalogue:\s*(.+?)\s*\n\s*lastUpdated:\s*(.+?)\s*\n/,
  );
  if (!m) return null;
  return {
    appliedHarness: m[1].trim(),
    appliedVersion: m[2].trim(),
    sourceCatalogue: m[3].trim(),
    lastUpdated: m[4].trim(),
  };
}

/** Synchronous catalogue name read for autocomplete (best-effort, local only).
 *  Official distros live on GitHub and aren't available to synchronous
 *  tab-completion — they appear once a command runs and reads the catalogue. */
export function getCatalogueNamesSync(): string[] {
  const dir = getUserHarnessesDir();
  const names: string[] = [];
  if (existsSync(dir)) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== ".trash" && existsSync(join(dir, entry.name, "harness.md"))) {
          names.push(entry.name);
        }
      }
    } catch { /* ignore */ }
  }
  return [...new Set(names)].sort();
}

/** Directory containing user-saved harnesses (~/.pi/harnesses/). */
export function getUserHarnessesDir(): string {
  return join(homedir(), ".pi", "harnesses");
}

/**
 * Read the effective catalogue: official distros (GitHub, dynamic) ∪ user harnesses.
 * On name collision, user takes precedence.
 * Returns sorted: official first (alphabetical), then user (alphabetical).
 * Never throws on network failure — official distros are simply omitted and the
 * catalogue degrades to local-only.
 */
export async function readCatalogue(): Promise<HarnessEntry[]> {
  const official = await listOfficialDistros();
  const users = readHarnessesFromDir(getUserHarnessesDir(), "user");

  // User takes precedence on collision
  const userNames = new Set(users.map((u) => u.name));
  const filteredOfficial = official.filter((o) => !userNames.has(o.name));

  filteredOfficial.sort((a, b) => a.name.localeCompare(b.name));
  users.sort((a, b) => a.name.localeCompare(b.name));

  return [...filteredOfficial, ...users];
}

/** Read only local (user) harnesses — no network. Used by update/status local
 *  resolution and anywhere a network call is undesirable. */
export function readLocalCatalogue(): HarnessEntry[] {
  return readHarnessesFromDir(getUserHarnessesDir(), "user");
}

/** Find a harness by name in the catalogue. */
export function findHarness(
  name: string,
  catalogue: HarnessEntry[],
): HarnessEntry | undefined {
  return catalogue.find((h) => h.name === name);
}

/**
 * Walk a files/ directory tree and return relative paths.
 * source = relative path within files/, target = same relative path in the project.
 */
export async function listBundledFiles(
  filesDir: string,
): Promise<BundledFile[]> {
  if (!existsSync(filesDir)) return [];
  const results: BundledFile[] = [];
  walkDir(filesDir, filesDir, results);
  return results.sort((a, b) => a.source.localeCompare(b.source));
}

/** Read the harness.md body (content after frontmatter). */
export async function readHarnessBody(harnessMdPath: string): Promise<string> {
  const content = readFileSync(harnessMdPath, "utf-8");
  return extractBody(content);
}

/** Read the full harness.md file content. */
export async function readFullHarnessMd(harnessMdPath: string): Promise<string> {
  return readFileSync(harnessMdPath, "utf-8");
}

// --- Internal helpers ---

function readHarnessesFromDir(
  dir: string,
  source: "user",
): HarnessEntry[] {
  if (!existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== ".trash")
      .map((e) => e.name);
  } catch {
    return [];
  }

  const harnesses: HarnessEntry[] = [];
  for (const name of entries) {
    const harnessDir = join(dir, name);
    const harnessMdPath = join(harnessDir, "harness.md");
    if (!existsSync(harnessMdPath)) continue;

    try {
      const content = readFileSync(harnessMdPath, "utf-8");
      const fm = parseFrontmatter(content);
      if (!fm?.name) continue;

      const filesDir = join(harnessDir, "files");
      harnesses.push({
        name: fm.name,
        title: fm.title ?? fm.name,
        description: fm.description ?? "",
        version: fm.version ?? "0.0.0",
        source,
        dir: harnessDir,
        harnessMdPath,
        filesDir: existsSync(filesDir) ? filesDir : undefined,
      });
    } catch {
      // Skip unparseable harnesses
    }
  }
  return harnesses;
}

function walkDir(
  base: string,
  current: string,
  results: BundledFile[],
): void {
  let entries;
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      walkDir(base, fullPath, results);
    } else if (entry.isFile()) {
      const rel = relative(base, fullPath);
      results.push({ source: rel, target: rel });
    }
  }
}

// --- Source labelling (for selectors / list / status) ---

/** A short human label for a distro source, shown in selectors and lists. */
export function sourceLabel(source: string): string {
  if (isOfficialSource(source)) return "Official";
  if (source === "user") return "Local";
  if (source.startsWith("github:")) return `GitHub (${source.slice("github:".length)})`;
  return source;
}
