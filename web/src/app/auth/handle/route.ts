// GET /auth/handle: the caller's handle. POST /auth/handle { handle }: set it. The player is always the one behind
// the session token, never an id from the body, and only that player's players.handle is written (secret key).
import { checkHandle } from "../../../data/account";
import { isServerConfigured, readHandle, SupabaseError, userFromToken, writeHandle } from "../../../data/server";

const MAX_BODY_BYTES = 1024;

const fail = (status: number, error: string) => Response.json({ error }, { status });
const caller = (request: Request) => userFromToken(request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? null);

export async function GET(request: Request) {
  if (!isServerConfigured()) return fail(503, "take store not configured");
  const user = await caller(request);
  if (!user) return fail(401, "sign in first");
  try {
    return Response.json({ handle: await readHandle(user.id) });
  } catch (e) {
    console.error("handle read failed", e);
    return fail(502, "couldn't read the handle");
  }
}

export async function POST(request: Request) {
  if (!isServerConfigured()) return fail(503, "take store not configured");
  const user = await caller(request);
  if (!user) return fail(401, "sign in first");

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, "body too large");
    body = JSON.parse(text);
  } catch {
    return fail(400, "body is not JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "send { handle }");
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "handle") return fail(400, "send only { handle }: the player is the one signed in");

  const checked = checkHandle((body as { handle: unknown }).handle);
  if (!checked.ok) return fail(422, checked.reason);
  try {
    return Response.json({ handle: await writeHandle(user.id, checked.handle) });
  } catch (e) {
    if (e instanceof SupabaseError && e.status === 400) return fail(422, "Letters, numbers, spaces and _ only.");
    console.error("handle write failed", e);
    return fail(502, "couldn't save the handle");
  }
}
