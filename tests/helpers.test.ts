import { test } from "node:test";
import assert from "node:assert/strict";

import { parseFrontmatter, serializeFrontmatter, extractBody } from "../extensions/frontmatter.ts";
import { parsePackageList, parsePackageListWithScope, parseProvenance } from "../extensions/catalogue.ts";
import { parseGithubRef, looksLikeGithubRef, isOfficialSource, officialSource, officialNameFromSource } from "../extensions/github.ts";
import { readProjectPackages, readGlobalPackages, compareVersions } from "../extensions/util.ts";

// --- frontmatter ---

test("parseFrontmatter: simple key: value pairs", () => {
  const fm = parseFrontmatter("---\nname: my-distro\ntitle: My Distro\nversion: 1.0.0\n---\nbody");
  assert.equal(fm?.name, "my-distro");
  assert.equal(fm?.title, "My Distro");
  assert.equal(fm?.version, "1.0.0");
});

test("parseFrontmatter: folded scalar (>) joins indented lines", () => {
  const md = "---\ndescription: >\n  A concise description\n  across two lines.\n---\n";
  assert.equal(fm_description(md), "A concise description across two lines.");
});

test("parseFrontmatter: inline array", () => {
  const fm = parseFrontmatter("---\ntags: [web, react, node]\n---\n");
  assert.deepEqual(fm?.tags, ["web", "react", "node"]);
});

test("parseFrontmatter: strips surrounding quotes", () => {
  const fm = parseFrontmatter('---\nname: "quoted-name"\n---\n');
  assert.equal(fm?.name, "quoted-name");
});

test("parseFrontmatter: returns null when no frontmatter block", () => {
  assert.equal(parseFrontmatter("just body, no fences"), null);
  assert.equal(parseFrontmatter("---\nname: x\nno closing fence"), null);
});

test("serializeFrontmatter: round-trips simple fields and arrays", () => {
  const out = serializeFrontmatter({ name: "x", tags: ["a", "b"] });
  assert.ok(out.startsWith("---\n"));
  assert.ok(out.endsWith("\n---"));
  assert.ok(out.includes("name: x"));
  assert.ok(out.includes("tags: [a, b]"));
});

test("serializeFrontmatter: multi-line string uses folded scalar", () => {
  const out = serializeFrontmatter({ description: "line one\nline two" });
  assert.ok(out.includes("description: >"));
  assert.ok(out.includes("  line one"));
  assert.ok(out.includes("  line two"));
});

test("extractBody: returns body after frontmatter", () => {
  assert.equal(extractBody("---\nname: x\n---\n# Hello\nworld"), "# Hello\nworld");
});

test("extractBody: returns full content when no frontmatter", () => {
  assert.equal(extractBody("no fences here"), "no fences here");
});

// --- package list ---

test("parsePackageList: extracts npm: packages from the pi packages section", () => {
  const body = "## pi packages to install\n- `npm:pi-web-access` — web search\n- `npm:pi-goal` — goals\n\n## Context\nother stuff";
  assert.deepEqual(parsePackageList(body), ["npm:pi-web-access", "npm:pi-goal"]);
});

test("parsePackageList: stops at the next section heading", () => {
  const body = "## pi packages to install\n- `npm:pi-goal`\n## Hooks\n- `npm:should-not-match`";
  assert.deepEqual(parsePackageList(body), ["npm:pi-goal"]);
});

test("parsePackageList: ignores non-npm list items", () => {
  const body = "## pi packages to install\n- `git:github.com/foo/bar`\n- plain text";
  assert.deepEqual(parsePackageList(body), []);
});

// --- package list with scope ---

test("parsePackageListWithScope: defaults to local when no marker", () => {
  const body = "## pi packages to install\n- `npm:pi-web-access` — web search\n- `npm:pi-goal` — goals";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:pi-web-access", scope: "local" },
    { source: "npm:pi-goal", scope: "local" },
  ]);
});

test("parsePackageListWithScope: (global) marker sets scope to global", () => {
  const body = "## pi packages to install\n- `npm:pi-web-access` — web search\n- `npm:my-shared-tool` (global) — a user-wide tool";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:pi-web-access", scope: "local" },
    { source: "npm:my-shared-tool", scope: "global" },
  ]);
});

test("parsePackageListWithScope: (local) marker is accepted and stays local", () => {
  const body = "## pi packages to install\n- `npm:foo` (local)";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:foo", scope: "local" },
  ]);
});

test("parsePackageListWithScope: stops at the next section heading", () => {
  const body = "## pi packages to install\n- `npm:pi-goal`\n## Hooks\n- `npm:should-not-match`";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:pi-goal", scope: "local" },
  ]);
});

test("parsePackageListWithScope: an h1 heading also ends the section", () => {
  const body = "## pi packages to install\n- `npm:pi-goal`\n# Top-level heading\n- `npm:should-not-match`";
  assert.deepEqual(parsePackageListWithScope(body).map((p) => p.source), ["npm:pi-goal"]);
});

test("parsePackageListWithScope: an h3 subsection does NOT end the section", () => {
  const body = "## pi packages to install\n### core\n- `npm:a`\n### extras\n- `npm:b`";
  assert.deepEqual(parsePackageListWithScope(body).map((p) => p.source), ["npm:a", "npm:b"]);
});

test("parsePackageListWithScope: (global) inside description prose is ignored", () => {
  const body = "## pi packages to install\n- `npm:foo` — a tool that works (global) everywhere";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:foo", scope: "local" },
  ]);
});

test("parsePackageListWithScope: marker before the description dash sets scope", () => {
  const body = "## pi packages to install\n- `npm:foo` (global) — a user-wide tool";
  assert.deepEqual(parsePackageListWithScope(body), [
    { source: "npm:foo", scope: "global" },
  ]);
});

test("parsePackageList: still returns source strings (backward compat)", () => {
  const body = "## pi packages to install\n- `npm:foo` (global)\n- `npm:bar`";
  // parsePackageList returns sources only — scope markers are stripped
  assert.deepEqual(parsePackageList(body), ["npm:foo", "npm:bar"]);
});

// --- package readers (local + global) ---

test("readProjectPackages: returns [] when .pi/settings.json absent", () => {
  assert.deepEqual(readProjectPackages("/nonexistent/path/that/does/not/exist"), []);
});

test("readGlobalPackages: returns a value (string array) without throwing", () => {
  // May be [] on this machine if no global packages, but must not throw and must be an array.
  const result = readGlobalPackages();
  assert.ok(Array.isArray(result), "readGlobalPackages must return an array");
  result.forEach((p) => assert.equal(typeof p, "string"));
});

// --- provenance ---

test("parseProvenance: parses a provenance header", () => {
  const content = "<!-- pi-distro provenance\n     appliedHarness: web-fullstack\n     appliedVersion: 1.2.0\n     sourceCatalogue: github:msdavid/pi-distro/harnesses/web-fullstack\n     lastUpdated: 2026-07-09T00:00:00Z\n-->";
  const p = parseProvenance(content);
  assert.equal(p?.appliedHarness, "web-fullstack");
  assert.equal(p?.appliedVersion, "1.2.0");
  assert.equal(p?.sourceCatalogue, "github:msdavid/pi-distro/harnesses/web-fullstack");
  assert.equal(p?.lastUpdated, "2026-07-09T00:00:00Z");
});

test("parseProvenance: returns null when header absent", () => {
  assert.equal(parseProvenance("# just a harness\n\nbody"), null);
});

test("parseProvenance: field order does not matter", () => {
  const content = "<!-- pi-distro provenance\n     appliedVersion: 1.2.0\n     lastUpdated: 2026-07-09T00:00:00Z\n     appliedHarness: web-fullstack\n     sourceCatalogue: user\n-->";
  const p = parseProvenance(content);
  assert.equal(p?.appliedHarness, "web-fullstack");
  assert.equal(p?.appliedVersion, "1.2.0");
  assert.equal(p?.sourceCatalogue, "user");
  assert.equal(p?.lastUpdated, "2026-07-09T00:00:00Z");
});

test("parseProvenance: returns null when a required field is missing", () => {
  const content = "<!-- pi-distro provenance\n     appliedHarness: x\n     appliedVersion: 1.0.0\n-->";
  assert.equal(parseProvenance(content), null);
});

// --- version comparison ---

test("compareVersions: basic ordering", () => {
  assert.ok(compareVersions("1.2.0", "1.1.9") > 0);
  assert.ok(compareVersions("0.9.0", "1.0.0") < 0);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.ok(compareVersions("1.0.0.1", "1.0.0") > 0); // extra segment tolerated
});

test("compareVersions: tolerates a leading v prefix", () => {
  assert.equal(compareVersions("v1.2.0", "1.2.0"), 0);
  assert.ok(compareVersions("v2.0.0", "1.9.9") > 0);
});

test("compareVersions: a prerelease sorts before its release", () => {
  assert.ok(compareVersions("1.0.0-beta", "1.0.0") < 0);
  assert.ok(compareVersions("1.0.0", "1.0.0-beta") > 0);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0-beta"), 0);
  assert.ok(compareVersions("1.0.0-alpha", "1.0.0-beta") < 0);
  assert.ok(compareVersions("1.0.1-alpha", "1.0.0") > 0); // higher core wins over prerelease
});

// --- github refs ---

test("parseGithubRef: owner/repo", () => {
  const r = parseGithubRef("earendil-works/pi");
  assert.equal(r?.owner, "earendil-works");
  assert.equal(r?.repo, "pi");
  assert.equal(r?.subPath, "");
  assert.equal(r?.displayRef, "earendil-works/pi");
});

test("parseGithubRef: owner/repo/subpath", () => {
  const r = parseGithubRef("earendil-works/pi/distros/web");
  assert.equal(r?.subPath, "distros/web");
  assert.equal(r?.displayRef, "earendil-works/pi/distros/web");
});

test("parseGithubRef: full https URL with .git and trailing slash", () => {
  const r = parseGithubRef("https://github.com/earendil-works/pi.git/");
  assert.equal(r?.owner, "earendil-works");
  assert.equal(r?.repo, "pi");
  assert.equal(r?.subPath, "");
});

test("parseGithubRef: rejects invalid input", () => {
  assert.equal(parseGithubRef("no-slash"), undefined);
  assert.equal(parseGithubRef("bad owner/repo"), undefined);
});

test("looksLikeGithubRef: true for slash refs, false otherwise", () => {
  assert.equal(looksLikeGithubRef("earendil-works/pi"), true);
  assert.equal(looksLikeGithubRef("local-distro-name"), false);
});

// --- official distro helpers ---

test("isOfficialSource: true for the official repo source", () => {
  assert.equal(isOfficialSource("github:msdavid/pi-distro/harnesses/minimal"), true);
  assert.equal(isOfficialSource("github:msdavid/pi-distro/harnesses/cc-knockoff"), true);
  assert.equal(isOfficialSource("user"), false);
  assert.equal(isOfficialSource("github:earendil-works/pi"), false);
});

test("officialSource: builds the source string for a name", () => {
  assert.equal(officialSource("minimal"), "github:msdavid/pi-distro/harnesses/minimal");
  assert.equal(officialSource("cc-knockoff"), "github:msdavid/pi-distro/harnesses/cc-knockoff");
});

test("officialNameFromSource: extracts the distro name", () => {
  assert.equal(officialNameFromSource("github:msdavid/pi-distro/harnesses/minimal"), "minimal");
  assert.equal(officialNameFromSource("github:msdavid/pi-distro/harnesses/cc-knockoff"), "cc-knockoff");
  assert.equal(officialNameFromSource("github:earendil-works/pi"), undefined);
  assert.equal(officialNameFromSource("user"), undefined);
});

test("parseGithubRef: official ref msdavid/pi-distro/harnesses/<name>", () => {
  const r = parseGithubRef("msdavid/pi-distro/harnesses/cc-knockoff")!;
  assert.equal(r.owner, "msdavid");
  assert.equal(r.repo, "pi-distro");
  assert.equal(r.subPath, "harnesses/cc-knockoff");
  assert.equal(r.displayRef, "msdavid/pi-distro/harnesses/cc-knockoff");
});

// helper: pull description out of folded scalar for the fold test
function fm_description(md: string): string | undefined {
  return parseFrontmatter(md)?.description;
}
