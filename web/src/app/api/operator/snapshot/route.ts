// "Freeze snapshot": writes the current board, minus heartbeats, to web/public/operator/snapshot.json. Development only.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { toSnapshot } from "../../../../operator/board";
import { cachedBoard, repoRoot } from "../../../../operator/collect";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response("Forbidden", { status: 403 });
  const dir = join(await repoRoot(), "web/public/operator");
  const snapshot = toSnapshot(await cachedBoard());
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
  return Response.json({ ok: true, at: snapshot.at, sha: snapshot.sha });
}
