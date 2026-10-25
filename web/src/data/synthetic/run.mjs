// Runs load.ts under Vite's module runner (the one vitest uses), which resolves the TypeScript, the extensionless
// imports and the JSON that plain `node` can't. From web/: `node src/data/synthetic/run.mjs --dry-run`.
import path from "node:path";
import { createViteServer } from "vitest/node";

const web = path.resolve(import.meta.dirname, "../../..");
const server = await createViteServer({
  root: web,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { "@": path.join(web, "src") } },
});
try {
  const { main } = await server.ssrLoadModule("/src/data/synthetic/load.ts");
  await main(process.argv.slice(2));
} finally {
  await server.close();
}
