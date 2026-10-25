// Build stamp (spec: build-stamp): the short commit and its age in the top-right of /, so a stale checkout shows.
// A server component: git runs at render, so `next dev` shows the commit it serves after a pull and `next build`
// stamps the built commit. No git: "unknown build".
import { execFileSync } from "node:child_process";
import { StampAge } from "./age";
import styles from "./build-stamp.module.css";

function readCommit(): { sha: string; committedAt: string } | null {
  try {
    const [sha, committedAt] = execFileSync("git", ["log", "-1", "--format=%h%n%cI"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n");
    return sha && committedAt ? { sha, committedAt } : null;
  } catch {
    return null;
  }
}

export function BuildStamp() {
  const commit = readCommit();
  return (
    <div className={styles.stamp} data-capture-hide data-testid="build-stamp" title={commit?.committedAt}>
      {commit ? <StampAge sha={commit.sha} committedAt={commit.committedAt} /> : "unknown build"}
    </div>
  );
}
