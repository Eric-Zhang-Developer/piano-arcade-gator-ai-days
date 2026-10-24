// Live mode: the operator board, collected at most once a minute. Development only: a production build has no gh
// login to use, so it 404s and the page falls back to the committed snapshot.
import { cachedBoard } from "../../../operator/collect";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return Response.json(await cachedBoard());
}
