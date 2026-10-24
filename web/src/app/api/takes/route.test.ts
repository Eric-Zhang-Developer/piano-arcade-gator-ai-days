import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import type { Chart, Take } from "../../../contracts";
import { judgeTake } from "../../../game/core/judge";
import { saveTake } from "../../../data/server";
import { POST } from "./route";

vi.mock("../../../data/server", () => ({
  isServerConfigured: () => true, userFromToken: async () => ({ id: "00000000-0000-4000-8000-000000000002" }),
  ensurePlayer: async () => {}, upsertSong: async () => {}, saveTake: vi.fn(async () => "saved"),
  SupabaseError: class extends Error {},
}));
const chart: Chart = JSON.parse(readFileSync(new URL("../../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const note = chart.notes.find(n => n.duration >= 1.5)!;
const base: Take = { chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", inputDevice: "midi", latencyOffsetMs: 0, events: [{ pitch: note.pitch, velocity: 80, timeMs: note.beat * 600, offTimeMs: note.beat * 600 + 50 }] };
const request = (take: unknown) => new Request("http://localhost/api/takes", { method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" }, body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000001", take }) });
beforeEach(() => vi.mocked(saveTake).mockClear());
test.each([1, 2, 3] as const)("server preserves policy%s and independently reproduces its credit", async version => {
  const take = version === 1 ? base : { ...base, scoringVersion: version };
  const response = await POST(request(take));
  expect(response.status).toBe(201);
  const saved = vi.mocked(saveTake).mock.calls[0][0];
  expect(saved.take).toEqual(take);
  expect(saved.results).toEqual(judgeTake(chart, take));
  expect(saved.judge_version).toBe(version);
  expect(saved.contract_version).toBe(version);
});
test("unsupported scoring policy is rejected before saving", async () => {
  expect((await POST(request({ ...base, scoringVersion: 4 }))).status).toBe(400);
  expect(saveTake).not.toHaveBeenCalled();
});
