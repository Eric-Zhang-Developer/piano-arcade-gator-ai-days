import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Build progress, read from the repo at build time. A feature counts as done only when changes/<slug>.md exists
// (AGENTS.md), so this page can never claim more than main has.

export interface FeatureStatus {
  slug: string;
  name: string; // the spec's one-line name, or the slug if the spec can't be read
  done: boolean;
}

export interface MilestoneStatus {
  name: string;
  features: FeatureStatus[];
}

const ROOT = path.join(process.cwd(), "..");

function specName(slug: string): string {
  try {
    const spec = readFileSync(path.join(ROOT, "specs", "features", slug, "spec.md"), "utf8");
    const m = spec.match(/^name:\s*"?(.+?)"?\s*$/m);
    return m ? m[1] : slug;
  } catch {
    return slug;
  }
}

// null when the files aren't there (for example a deploy that ships only web/): the page says so.
export function readProgress(): MilestoneStatus[] | null {
  let toml: string;
  try {
    toml = readFileSync(path.join(ROOT, "specs", "milestones.toml"), "utf8");
  } catch {
    return null;
  }
  return toml
    .split(/^\[\[milestone\]\]\s*$/m)
    .slice(1)
    .map((block) => {
      const name = block.match(/^name\s*=\s*"([^"]*)"/m)?.[1] ?? "";
      const list = block.match(/^features\s*=\s*\[([^\]]*)\]/m)?.[1] ?? "";
      const slugs = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      return {
        name,
        features: slugs.map((slug) => ({
          slug,
          name: specName(slug),
          done: existsSync(path.join(ROOT, "changes", `${slug}.md`)),
        })),
      };
    });
}
