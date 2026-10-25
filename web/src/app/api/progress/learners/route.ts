// GET /api/progress/learners: the 200 synthetic learners /progress can show, one line each (data/synthetic/roster.json).
// Synthetic, not real students: no account is read, so it answers signed in or not.
import { isServerConfigured } from "../../../../data/server";
import { ROSTER } from "../../../../data/synthetic/roster";

export function GET() {
  if (!isServerConfigured()) return Response.json({ error: "take store not configured" }, { status: 503 });
  return Response.json({ learners: ROSTER });
}
