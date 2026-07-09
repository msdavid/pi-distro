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
