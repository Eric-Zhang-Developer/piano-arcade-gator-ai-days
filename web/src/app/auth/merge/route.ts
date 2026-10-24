// POST /auth/merge { fromToken }: after "Sign in with Google" on a device that had played anonymously, move that
// device's takes to the Google account. Both sessions must be real, and only an anonymous user is ever merged away,
// so nobody can pull another player's history into their own account.
import { deleteAuthUser, isServerConfigured, mergePlayer, userFromToken } from "../../../data/server";

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!isServerConfigured()) return fail(503, "take store not configured");
  const to = await userFromToken(request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? null);
  if (!to) return fail(401, "sign in first");
  let fromToken: unknown;
  try {
    fromToken = ((await request.json()) as { fromToken?: unknown }).fromToken;
  } catch {
    return fail(400, "body is not JSON");
  }
  if (typeof fromToken !== "string" || fromToken.length > 4096) return fail(400, "fromToken must be a session token");
  const from = await userFromToken(fromToken);
  if (!from) return fail(401, "the device's old session has expired");
  if (from.id === to.id) return Response.json({ moved: 0 });
  if (!from.isAnonymous) return fail(403, "only an anonymous player can be merged into an account");
  if (to.isAnonymous) return fail(403, "merge into a Google account, not another anonymous player");
  try {
    const moved = await mergePlayer(from.id, to.id);
    await deleteAuthUser(from.id);
    return Response.json({ moved });
  } catch (e) {
    console.error("merge failed", e);
    return fail(502, "merge failed");
  }
}
