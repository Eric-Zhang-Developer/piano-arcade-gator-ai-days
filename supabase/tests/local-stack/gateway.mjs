// Local stand-in for the Supabase gateway + Auth (anonymous sign-up, /user, apikey to role) for end-to-end tests.
// Never deploy it. Env: PGHOST (socket dir), PGPORT. PostgREST must listen on :3001 with the same JWT secret.
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const SECRET = "test-secret-test-secret-test-secret-1234";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (claims) => { const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 }); return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`; };
const verify = (t) => { const [h, p, s] = (t || "").split("."); if (!s || createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") !== s) return null; return JSON.parse(Buffer.from(p, "base64url")); };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  const url = new URL(req.url, "http://x"); const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
  const json = (code, o) => { res.writeHead(code, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify(o)); };
  if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
    if (req.headers.apikey !== "sb_publishable_test") return json(401, { msg: "bad apikey" });
    const id = randomUUID();
    execFileSync("psql", ["-h", process.env.PGHOST || "/var/tmp/pge", "-p", process.env.PGPORT || "5498", "-U", "postgres", "-qc", `insert into auth.users(id) values ('${id}')`]);
    return json(200, { access_token: sign({ sub: id, role: "authenticated", is_anonymous: true }), refresh_token: "r-" + id, expires_in: 3600, user: { id, is_anonymous: true } });
  }
  if (url.pathname === "/auth/v1/user") { const c = verify(bearer); return c ? json(200, { id: c.sub, is_anonymous: c.is_anonymous }) : json(401, { msg: "bad jwt" }); }
  if (url.pathname.startsWith("/rest/v1/")) {
    let auth;
    if (req.headers.apikey === "sb_secret_test") auth = sign({ role: "service_role" });
    else if (req.headers.apikey === "sb_publishable_test") auth = verify(bearer) ? bearer : sign({ role: "anon" });
    else return json(401, { msg: "bad apikey" });
    const r = await fetch("http://localhost:3001" + url.pathname.slice(8) + url.search, { method: req.method, headers: { "Content-Type": "application/json", Prefer: req.headers.prefer || "", Authorization: `Bearer ${auth}` }, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
    res.writeHead(r.status, { "Content-Type": "application/json", ...cors }); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  json(404, { msg: "not found" });
}).listen(54321);
