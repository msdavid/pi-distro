/**
 * Tiny inline YAML frontmatter parser for harness.md files.
 *
 * No external yaml dependency — only handles the fields used by harness.md:
 * name, title, description, version, author, tags.
 *
 * Supports:
 * - Simple `key: value` pairs
 * - YAML `>` folded scalar for multi-line descriptions
 * - Inline array `[a, b, c]`
 */

export interface Frontmatter {
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Parse the YAML frontmatter block from a harness.md (or any markdown) string.
 * Returns the parsed fields and null if no frontmatter block is found.
 */
export function parseFrontmatter(content: string): Frontmatter | null {
  const lines = content.split(/\r?\n/);

  // Must start with ---
  if (lines[0]?.trim() !== "---") {
    return null;
  }

  // Find closing ---
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return null;
  }

  const yamlLines = lines.slice(1, end);
  return parseYamlLines(yamlLines);
}

/**
 * Serialize a frontmatter object back to a YAML block string (with --- fences).
 */
export function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => String(v)).join(", ")}]`);
    } else if (typeof value === "string" && value.includes("\n")) {
      // Use folded scalar for multi-line
      lines.push(`${key}: >`);
      for (const sub of value.split("\n")) {
        lines.push(`  ${sub}`);
      }
    } else {
      lines.push(`${key}: ${formatScalar(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Extract the body (everything after the frontmatter block).
 * If there's no frontmatter, returns the full content.
 */
export function extractBody(content: string): string {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return content;
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return content;
  }
  return lines.slice(end + 1).join("\n").replace(/^\n+/, "");
}

// --- Internal helpers ---

function parseYamlLines(lines: string[]): Frontmatter {
  const result: Frontmatter = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.trim() === "" || line.trim().startsWith("#")) {
      i++;
      continue;
    }

    const match = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      i++;
      continue;
    }
    const key = match[1];
    let value = match[2].trim();

    // Handle folded scalar (> or >-)
    if (value === ">" || value === ">-") {
      const folded: string[] = [];
      i++;
      while (i < lines.length && (lines[i]?.startsWith("  ") || lines[i]?.startsWith("\t") || lines[i]?.trim() === "")) {
        folded.push((lines[i] ?? "").replace(/^[ \t]+/, ""));
        i++;
      }
      result[key] = folded.join(" ").trim();
      continue;
    }

    // Handle inline array
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      i++;
      continue;
    }

    // Strip surrounding quotes
    result[key] = value.replace(/^["']|["']$/g, "");
    i++;
  }
  return result;
}

function formatScalar(value: unknown): string {
  if (typeof value === "string") {
    // Quote if contains special chars
    if (/[:#{}\[\],&*?|<>=!%@`]/.test(value) || value.includes("\n")) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return String(value);
}
