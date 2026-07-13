/**
 * Validates the shipped official distros under harnesses/ against the authoring
 * rules in docs/authoring.md: frontmatter validity, name/directory match, plain
 * semver, description length, README presence, and — in both directions — that
 * the "Bundled files" manifest in harness.md agrees with what's on disk under
 * files/. (The reverse check catches files deleted from files/ but still listed,
 * and files added but never listed.)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { parseFrontmatter, extractBody } from "../extensions/frontmatter.ts";
import { parsePackageList } from "../extensions/catalogue.ts";

const HARNESSES_DIR = join(import.meta.dirname, "..", "harnesses");

const distroDirs = readdirSync(HARNESSES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

function walkFiles(base: string, current: string, out: string[]): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const fp = join(current, entry.name);
    if (entry.isDirectory()) walkFiles(base, fp, out);
    else if (entry.isFile()) out.push(relative(base, fp));
  }
}

test("harnesses/ contains at least one distro", () => {
  assert.ok(distroDirs.length > 0);
});

for (const name of distroDirs) {
  const distroDir = join(HARNESSES_DIR, name);
  const md = readFileSync(join(distroDir, "harness.md"), "utf-8");

  test(`harness '${name}': frontmatter follows the authoring rules`, () => {
    const fm = parseFrontmatter(md);
    assert.ok(fm, "frontmatter parses");
    assert.equal(fm?.name, name, "frontmatter name matches the directory name");
    assert.ok(fm?.title, "title present");
    assert.ok(fm?.description, "description present");
    assert.ok(
      (fm?.description?.length ?? 0) <= 300,
      `description must be ≤300 chars (got ${fm?.description?.length})`,
    );
    assert.match(fm?.version ?? "", /^\d+\.\d+\.\d+$/, "version is plain semver (no v prefix)");
  });

  test(`harness '${name}': has a README.md`, () => {
    assert.ok(existsSync(join(distroDir, "README.md")));
  });

  test(`harness '${name}': bundled-files manifest matches files/ on disk`, () => {
    const body = extractBody(md);
    const listed = [...body.matchAll(/^-\s+`files\/([^`]+)`/gm)].map((m) => m[1]);
    const filesDir = join(distroDir, "files");
    const onDisk: string[] = [];
    if (existsSync(filesDir)) walkFiles(filesDir, filesDir, onDisk);

    for (const rel of listed) {
      assert.ok(onDisk.includes(rel), `listed bundled file 'files/${rel}' exists on disk`);
    }
    for (const rel of onDisk) {
      assert.ok(listed.includes(rel), `on-disk file 'files/${rel}' is listed in the manifest`);
    }
  });

  test(`harness '${name}': package list parses cleanly when a packages section exists`, () => {
    const body = extractBody(md);
    const hasSection = /^##\s+pi\s*packages/im.test(body);
    const packages = parsePackageList(body);
    if (hasSection && !/no additional pi packages/i.test(body)) {
      assert.ok(packages.length > 0, "packages section yields at least one npm: entry");
    }
    for (const p of packages) {
      assert.match(p, /^npm:[@a-z0-9][@a-z0-9-_./]*$/i, `well-formed package ref: ${p}`);
    }
  });
}
