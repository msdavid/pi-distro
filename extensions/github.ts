/**
 * GitHub distro pull logic for pi-distro.
 *
 * Supports fetching distros from GitHub repositories via shallow clone.
 * Used by `show <gh-repo>` and `deploy <gh-distro>` subcommands.
 *
 * Address format:
 *   owner/repo              → harness.md at repo root
 *   owner/repo/subpath      → harness.md at <subpath>/
 *   https://github.com/...  → full URLs also accepted
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseFrontmatter } from "./frontmatter.ts";
import type { HarnessEntry } from "./catalogue.ts";

export interface GithubRef {
  owner: string;
  repo: string;
  subPath: string; // "" for root
  displayRef: string; // "owner/repo" or "owner/repo/subpath"
}

/**
 * The official distros repo: `msdavid/pi-distro`, with distros under `harnesses/`.
 * Official distros are a special case of GitHub distros — they live here and are
 * fetched on demand (the npm package no longer ships bundled seeds).
 */
export const OFFICIAL_REPO = {
  owner: "msdavid",
  repo: "pi-distro",
  path: "harnesses",
  ref: "main",
} as const;

/** Official distro source prefix: `github:msdavid/pi-distro/harnesses/<name>`. */
export const OFFICIAL_SOURCE_PREFIX = `github:${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/${OFFICIAL_REPO.path}/`;

/** Whether a HarnessEntry.source / provenance sourceCatalogue is the official repo. */
export function isOfficialSource(source: string): boolean {
  return source.startsWith(OFFICIAL_SOURCE_PREFIX) ||
    source === `github:${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/${OFFICIAL_REPO.path}`;
}

/** Build the official source string for a distro name. */
export function officialSource(name: string): string {
  return `${OFFICIAL_SOURCE_PREFIX}${name}`;
}

/** Parse an official source string back into the distro name, or undefined. */
export function officialNameFromSource(source: string): string | undefined {
  if (source.startsWith(OFFICIAL_SOURCE_PREFIX)) {
    return source.slice(OFFICIAL_SOURCE_PREFIX.length);
  }
  if (source === `github:${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/${OFFICIAL_REPO.path}`) {
    return ""; // the bare harnesses path (shouldn't normally happen)
  }
  return undefined;
}

/**
 * Parse a GitHub reference: `owner/repo[/subpath]` or a full GitHub URL.
 * Returns undefined if the string doesn't look like a valid GitHub ref.
 */
export function parseGithubRef(ref: string): GithubRef | undefined {
  let s = ref.trim();
  s = s.replace(/^https?:\/\/github\.com\//, "");
  s = s.replace(/^github\.com\//, "");
  s = s.replace(/\/$/, ""); // strip trailing slash before .git so "repo.git/" is handled
  s = s.replace(/\.git$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return undefined;
  const [owner, repo, ...rest] = parts;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(owner)) return undefined;
  if (!/^[a-zA-Z0-9_.-]+$/.test(repo)) return undefined;
  const subPath = rest.join("/");
  return {
    owner,
    repo,
    subPath,
    displayRef: subPath ? `${owner}/${repo}/${subPath}` : `${owner}/${repo}`,
  };
}

/** Whether an argument looks like a GitHub reference (contains a `/`). */
export function looksLikeGithubRef(arg: string): boolean {
  return arg.includes("/") && parseGithubRef(arg) !== undefined;
}

/**
 * Shallow-clone a GitHub repo to a temp dir and return a HarnessEntry
 * pointing at the distro within it.
 *
 * Throws on clone failure or if harness.md is not found / unparseable.
 * The caller is responsible for calling `cleanup()` to remove the temp dir.
 */
export function fetchGithubDistro(
  ref: GithubRef,
): { entry: HarnessEntry; cleanup: () => void } {
  const cloneUrl = `https://github.com/${ref.owner}/${ref.repo}.git`;
  const tmp = mkdtempSync(join(tmpdir(), "pi-distro-gh-"));
  try {
    execSync(`git clone --depth 1 "${cloneUrl}" "${tmp}"`, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      encoding: "utf-8",
    });
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(
      `Failed to clone ${ref.displayRef}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const distroDir = ref.subPath ? join(tmp, ref.subPath) : tmp;
  const harnessMdPath = join(distroDir, "harness.md");
  if (!existsSync(harnessMdPath)) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(
      `No harness.md found ${ref.subPath ? `at '${ref.subPath}/' ` : ""}in ${ref.displayRef}`,
    );
  }

  const content = readFileSync(harnessMdPath, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm?.name) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`Invalid harness.md in ${ref.displayRef}: missing 'name' field`);
  }

  const filesDir = join(distroDir, "files");
  const entry: HarnessEntry = {
    name: fm.name,
    title: fm.title ?? fm.name,
    description: fm.description ?? "",
    version: fm.version ?? "0.0.0",
    source: `github:${ref.displayRef}`,
    dir: distroDir,
    harnessMdPath,
    filesDir: existsSync(filesDir) ? filesDir : undefined,
  };

  return { entry, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

// --- Official distros (dynamic, from OFFICIAL_REPO on GitHub) ---

/** In-memory cache for listOfficialDistros() to avoid repeat API calls in a session. */
let officialListCache: { entries: HarnessEntry[]; fetchedAt: number } | null = null;
const OFFICIAL_LIST_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * List official distros from OFFICIAL_REPO's `harnesses/` directory via the GitHub
 * Contents API (one call) + a raw frontmatter fetch per distro.
 *
 * Returns *listing* entries: `needsFetch: true`, no `dir`/`filesDir` (those are
 * populated by `fetchOfficialDistro()` when the user actually selects one).
 *
 * Never throws — on any network/parse failure returns [] (caller degrades to
 * local-only catalogue). Results are cached for OFFICIAL_LIST_TTL_MS.
 */
export async function listOfficialDistros(): Promise<HarnessEntry[]> {
  if (officialListCache && Date.now() - officialListCache.fetchedAt < OFFICIAL_LIST_TTL_MS) {
    return officialListCache.entries;
  }
  const entries = await listOfficialDistrosUncached();
  officialListCache = { entries, fetchedAt: Date.now() };
  return entries;
}

async function listOfficialDistrosUncached(): Promise<HarnessEntry[]> {
  // 1. List `harnesses/` subdirs via the Contents API.
  const contentsUrl = `https://api.github.com/repos/${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/contents/${OFFICIAL_REPO.path}?ref=${OFFICIAL_REPO.ref}`;
  let dirs: string[];
  try {
    const resp = await fetch(contentsUrl, {
      headers: { "Accept": "application/vnd.github+json", "User-Agent": "pi-distro" },
    });
    if (!resp.ok) return [];
    const listing = (await resp.json()) as Array<{ name: string; type: string }>;
    dirs = listing.filter((e) => e.type === "dir").map((e) => e.name);
  } catch {
    return [];
  }

  // 2. Fetch each distro's harness.md frontmatter (raw, unauthenticated).
  const entries: HarnessEntry[] = [];
  await Promise.all(dirs.map(async (name) => {
    const rawUrl = `https://raw.githubusercontent.com/${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/${OFFICIAL_REPO.ref}/${OFFICIAL_REPO.path}/${name}/harness.md`;
    try {
      const resp = await fetch(rawUrl, { headers: { "User-Agent": "pi-distro" } });
      if (!resp.ok) return;
      const content = await resp.text();
      const fm = parseFrontmatter(content);
      if (!fm?.name) return;
      entries.push({
        name: fm.name,
        title: fm.title ?? fm.name,
        description: fm.description ?? "",
        version: fm.version ?? "0.0.0",
        source: officialSource(fm.name),
        needsFetch: true,
      });
    } catch {
      // skip this distro
    }
  }));
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

/** Invalidate the official-list cache (used by tests / explicit refresh). */
export function clearOfficialListCache(): void {
  officialListCache = null;
}

/**
 * Fetch an official distro by name: shallow-clones OFFICIAL_REPO and points at
 * `harnesses/<name>/`. Returns { entry, cleanup } like fetchGithubDistro.
 * Throws on clone failure or if the distro/harness.md is missing.
 */
export function fetchOfficialDistro(
  name: string,
): { entry: HarnessEntry; cleanup: () => void } {
  return fetchGithubDistro({
    owner: OFFICIAL_REPO.owner,
    repo: OFFICIAL_REPO.repo,
    subPath: `${OFFICIAL_REPO.path}/${name}`,
    displayRef: `${OFFICIAL_REPO.owner}/${OFFICIAL_REPO.repo}/${OFFICIAL_REPO.path}/${name}`,
  });
}
