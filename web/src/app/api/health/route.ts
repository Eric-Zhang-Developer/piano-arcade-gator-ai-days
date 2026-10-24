// GET /api/health: which commit is live. `.agents/scripts/verify_release.py` checks it matches the merged main.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local", env: process.env.VERCEL_ENV ?? "local" });
}
