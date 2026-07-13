/**
 * pi-distro extension engine.
 *
 * Registers a single slash command `/pi-distro` that dispatches to
 * subcommands: deploy, undeploy, pick, update, save, list, show, status, remove.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

import { getCatalogueNamesSync } from "./catalogue.ts";
import { display } from "./util.ts";
import { handleShow } from "./show.ts";
import { handleDeploy } from "./deploy.ts";
import { handlePick } from "./pick.ts";
import { handleUndeploy } from "./undeploy.ts";
import { handleUpdate } from "./update.ts";
import { handleSave } from "./save.ts";
import { handleList, handleStatus, handleRemove } from "./info.ts";

const SUBCOMMANDS = [
  { name: "deploy", desc: "Deploy a distro (local name or gh: owner/repo[/sub])" },
  { name: "undeploy", desc: "Remove an applied distro from the current project" },
  { name: "pick", desc: "Partially deploy: select which packages/configs to apply from a distro" },
  { name: "update", desc: "Update the applied distro if a newer version exists" },
  { name: "save", desc: "Snapshot the current project config as a distro" },
  { name: "list", desc: "List all available distros" },
  { name: "show", desc: "Preview a distro dry-run (local name or gh: owner/repo[/sub])" },
  { name: "status", desc: "Show the current project's distro status" },
  { name: "remove", desc: "Delete a user distro" },
];

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("pi-distro", {
    description: "Manage pi distros (deploy, undeploy, pick, update, save, list, show, status, remove)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0] ?? "";
      const nameArg = parts[1];
      if (parts.length > 2) {
        ctx.ui.notify(`Ignoring extra arguments: ${parts.slice(2).join(" ")}`, "warning");
      }
      switch (sub) {
        case "": await handleHelp(pi); break;
        case "deploy": await handleDeploy(pi, ctx, nameArg); break;
        case "undeploy": await handleUndeploy(pi, ctx); break;
        case "pick": await handlePick(pi, ctx, nameArg); break;
        case "update": await handleUpdate(pi, ctx); break;
        case "save": await handleSave(pi, ctx); break;
        case "list": await handleList(pi); break;
        case "show": await handleShow(pi, nameArg); break;
        case "status": await handleStatus(pi, ctx); break;
        case "remove": await handleRemove(pi, ctx, nameArg); break;
        default:
          ctx.ui.notify(`Unknown subcommand: ${sub}`, "error");
          await handleHelp(pi);
      }
    },
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const items: AutocompleteItem[] = SUBCOMMANDS.map((s) => ({
        value: s.name, label: s.name, description: s.desc,
      }));
      const parts = prefix.split(/\s+/);
      const sub = parts[0];
      const namePrefix = parts.slice(1).join(" ");
      if ((sub === "show" || sub === "remove" || sub === "deploy" || sub === "pick")) {
        try {
          for (const name of getCatalogueNamesSync()) {
            if (!namePrefix || name.startsWith(namePrefix)) {
              items.push({ value: `${sub} ${name}`, label: name, description: "distro name" });
            }
          }
        } catch { /* ignore */ }
      }
      const filtered = items.filter((i) => i.value.startsWith(prefix) || i.label.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
  });
}

// --- help (no arg) ---

async function handleHelp(pi: ExtensionAPI): Promise<void> {
  const lines = SUBCOMMANDS.map((s) => `  **${s.name}** — ${s.desc}`);
  display(pi, `**pi-distro** — reusable pi configurations.\n\nUsage: \`/pi-distro <subcommand>\`\n\n${lines.join("\n")}`);
}
