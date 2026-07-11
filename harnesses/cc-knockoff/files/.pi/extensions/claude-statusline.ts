/**
 * Claude-style status line for pi.
 *
 * Clones the Claude Code footer format:
 *   <model> | <dir> | <style> | [████████░░] 80% | 45% cached | <branch (status)>
 *
 * - model       : active model name/id
 * - dir         : basename of ctx.cwd
 * - style       : current thinking level (pi's analog of Claude's "output style")
 * - context     : UTF-8 bar gauge of context-window usage (eighths resolution),
 *                 colored by level (accent → warning → error), plus usage % and
 *                 cache-read % (same token math as the Claude Code statusLine
 *                 command in ~/.claude/settings.json)
 * - git         : branch from footerData + dirty(!)/untracked(?) markers, refreshed
 *                 in the background so render() never spawns a process
 *
 * Auto-enables on session start. Also auto-expands tool outputs on session start
 * (the Ctrl+O effect) so full output is visible by default. Toggle the status line
 * with the /claude-statusline command.
 */

import { execSync } from "node:child_process";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { truncateToWidth } from "@earendil-works/pi-tui";

const REFRESH_MS = 2000;

/** Eighth-block characters for sub-cell bar precision (index = eighths, 0 = empty). */
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
const BAR_WIDTH = 10;

interface GitCache {
	branch: string | null;
	dirty: boolean;
	untracked: boolean;
}

export default function (pi: ExtensionAPI) {
	let enabled = false;
	let timer: ReturnType<typeof setInterval> | undefined;
	let gitCache: GitCache = { branch: null, dirty: false, untracked: false };

	function refreshGit(cwd: string): void {
		try {
			// One porcelain call gives us both dirty (staged/modified) and untracked flags.
			const out = execSync("git status --porcelain=v1 -z", {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 1500,
			});
			let dirty = false;
			let untracked = false;
			// -z separates records with NUL. Each record: <XY><space><path>\0...
			const records = out.split("\0").filter((r) => r.length > 0);
			for (const rec of records) {
				const xy = rec.slice(0, 2);
				if (xy === "??") {
					untracked = true;
				} else {
					dirty = true;
				}
				if (dirty && untracked) break;
			}
			gitCache = { ...gitCache, dirty, untracked };
		} catch {
			// Not a git repo, or git unavailable — clear flags.
			gitCache = { ...gitCache, dirty: false, untracked: false };
		}
	}

	function startTimer(ctx: ExtensionContext): void {
		stopTimer();
		refreshGit(ctx.cwd);
		timer = setInterval(() => refreshGit(ctx.cwd), REFRESH_MS);
		// Don't keep the event loop alive solely for footer refreshes.
		if (timer && typeof timer.unref === "function") timer.unref();
	}

	function stopTimer(): void {
		if (timer) {
			clearInterval(timer);
			timer = undefined;
		}
	}

	/**
	 * Render a fixed-width UTF-8 bar gauge for a fraction in [0,1].
	 * Filled cells use full blocks; the boundary cell uses an eighth-block for
	 * sub-cell precision. Returns [filled, empty] strings for separate coloring.
	 */
	function barGauge(fraction: number): { filled: string; empty: string } {
		const clamped = Math.max(0, Math.min(1, fraction));
		const totalEighths = Math.round(clamped * BAR_WIDTH * 8);
		const fullCells = Math.floor(totalEighths / 8);
		const remainder = totalEighths % 8;
		const filled = "█".repeat(fullCells) + (remainder > 0 ? EIGHTHS[remainder] : "");
		const filledWidth = fullCells + (remainder > 0 ? 1 : 0);
		const empty = "░".repeat(Math.max(0, BAR_WIDTH - filledWidth));
		return { filled, empty };
	}

	function enable(ctx: ExtensionContext): void {
		enabled = true;
		startTimer(ctx);

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => {
				gitCache = { ...gitCache, branch: footerData.getGitBranch() };
				tui.requestRender();
			});
			gitCache = { ...gitCache, branch: footerData.getGitBranch() };

			return {
				dispose: () => {
					unsub();
					stopTimer();
				},
				invalidate() {},
				render(width: number): string[] {
					const segments: string[] = [];

					// 1. Model
					const model = ctx.model;
					segments.push(theme.fg("accent", model?.name ?? model?.id ?? "no-model"));

					// 2. Cwd basename
					segments.push(theme.fg("dim", basename(ctx.cwd) || ctx.cwd));

					// 3. Style -> thinking level (pi's analog of output style).
					// getThinkingLevel() lives on the ExtensionAPI (pi), not on ctx.
					segments.push(theme.fg("dim", pi.getThinkingLevel()));

					// 4. Context: bar gauge + usage % + cache %.
					// Use pi's own context estimate (ctx.getContextUsage) — it represents the
					// current context size of the most recent request, matching Claude Code's
					// `context_window.current_usage`. Summing per-message usage would double-
					// count, since each request's input already includes prior context.
					const usage = ctx.getContextUsage();
					const usedPct = usage?.percent ?? 0;

					// Cache-read % comes from the last assistant message's usage (the most
					// recent request): cacheRead / (input + cacheWrite + cacheRead).
					let cachePct = 0;
					const branch = ctx.sessionManager.getBranch();
					for (let i = branch.length - 1; i >= 0; i--) {
						const e = branch[i];
						if (e.type === "message" && e.message.role === "assistant") {
							const u = (e.message as AssistantMessage).usage;
							const totalInput = u.input + u.cacheWrite + u.cacheRead;
							cachePct = totalInput > 0 ? Math.floor((u.cacheRead * 100) / totalInput) : 0;
							break;
						}
					}

					const { filled, empty } = barGauge(usedPct / 100);
					const barColor = usedPct >= 95 ? "error" : usedPct >= 80 ? "warning" : "accent";
					const bar = theme.fg(barColor, filled) + theme.fg("dim", empty);
					const pctLabel = theme.fg("dim", `${Math.floor(usedPct)}%`);

					let ctxInfo = `${bar} ${pctLabel}`;
					if (cachePct > 0) ctxInfo += theme.fg("dim", ` | ${cachePct}% cached`);
					segments.push(ctxInfo);

					// 5. Git: branch (!dirty ?untracked)
					if (gitCache.branch) {
						let status = "";
						if (gitCache.dirty) status += "!";
						if (gitCache.untracked) status += "?";
						const gitInfo = status ? `${gitCache.branch} (${status})` : gitCache.branch;
						segments.push(theme.fg("dim", gitInfo));
					}

					// Join with dim separators.
					const sep = theme.fg("muted", " | ");
					const line = segments.join(sep);

					return [truncateToWidth(line, width)];
				},
			};
		});
	}

	function disable(ctx: ExtensionContext): void {
		enabled = false;
		stopTimer();
		ctx.ui.setFooter(undefined);
	}

	// Auto-enable on every (re)start, and auto-expand tool outputs (the Ctrl+O effect).
	pi.on("session_start", async (_event, ctx) => {
		enable(ctx);
		ctx.ui.setToolsExpanded(true);
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		stopTimer();
	});

	// Refresh git right after a turn settles (catches file writes from the agent).
	pi.on("turn_end", async (_event, ctx) => {
		if (enabled) refreshGit(ctx.cwd);
	});

	// Manual toggle.
	pi.registerCommand("claude-statusline", {
		description: "Toggle the Claude-style status line footer",
		handler: async (_args, ctx) => {
			if (enabled) {
				disable(ctx);
				ctx.ui.notify("Claude status line: off", "info");
			} else {
				enable(ctx);
				ctx.ui.notify("Claude status line: on", "info");
			}
		},
	});
}
