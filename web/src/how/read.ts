// Server-only: /how's inputs from disk and git. Under `next build` this runs once; under `next dev`, per request.
// Every read that fails comes back null (shown as `unknown`); nothing here throws.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Board } from "../operator/board";
import { countLines, type Inputs } from "./data";

const git = (root: string, ...args: string[]): string | null => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 5_000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
  } catch {
    return null;
  }
};

const read = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

// A snapshot this page can read: operator-board's Board, at least the fields /how uses.
function snapshot(text: string | null): Board | null {
  try {
    const b = JSON.parse(text ?? "") as Board;
    return typeof b?.at === "string" && Array.isArray(b.features) && b.books ? b : null;
  } catch {
    return null;
  }
}

export function readInputs(webDir = process.cwd()): Inputs {
  const root = git(webDir, "rev-parse", "--show-toplevel")?.trim() || resolve(webDir, "..");
  const listed = git(root, "ls-files", "web/src");
  const files = listed
    ? listed
        .split("\n")
        .filter(Boolean)
        .map((path) => ({ path, text: read(join(root, path)) }))
        .filter((f) => f.text !== null)
        .map((f) => ({ path: f.path, lines: countLines(f.text!) }))
    : null;
  // The browser checks' first run on GitHub: run-checks.mjs as #433 merged it.
  const at433 = git(root, "log", "-1", "--format=%H", "--grep=(#433)$")?.trim();
  return {
    snapshot: snapshot(read(join(root, "web/public/operator/snapshot.json"))),
    files,
    runChecksAt433: at433 ? git(root, "show", `${at433}:web/e2e/run-checks.mjs`) : null,
    runChecksNow: read(join(root, "web/e2e/run-checks.mjs")),
    codeowners: read(join(root, ".github/CODEOWNERS")),
    agentsMd: read(join(root, "AGENTS.md")),
    remote: git(root, "config", "--get", "remote.origin.url"),
  };
}
