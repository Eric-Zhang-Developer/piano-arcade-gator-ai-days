import { describe, expect, it, vi } from "vitest";
import { mediaRun, stopTracks } from ".";

// A stream whose tracks count their stop() calls, and a getUserMedia that resolves when told to.
const stream = () => {
  const track = { stop: vi.fn() };
  return { track, s: { getTracks: () => [track] } as unknown as MediaStream };
};
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  return { p, resolve, reject };
};

// The shape of each page's start: open the camera, hold it, await the rest, check, then make the session.
async function start(runs: ReturnType<typeof mediaRun>, gum: Promise<MediaStream>, rest: Promise<void>, sessions: string[]) {
  const run = runs.start();
  try {
    const s = await gum;
    if (!run.hold(() => stopTracks(s))) return;
    await rest;
    if (!run.live()) return;
    sessions.push("session");
    run.hold(() => sessions.pop());
  } catch {
    if (run.live()) runs.stop();
  }
}

describe("one media start at a time (lab-camera-release)", () => {
  it("a teardown before the landmarker resolves stops the camera and makes no session (#1315)", async () => {
    const runs = mediaRun();
    const cam = stream();
    const landmarker = deferred<void>();
    const sessions: string[] = [];
    const going = start(runs, Promise.resolve(cam.s), landmarker.p, sessions);
    await Promise.resolve();
    await Promise.resolve();
    runs.stop(); // unmount, Stop or a song change (#1316)
    landmarker.resolve();
    await going;
    expect(cam.track.stop).toHaveBeenCalledOnce();
    expect(sessions).toEqual([]);
  });

  it("a rejecting landmarker stops the camera", async () => {
    const runs = mediaRun();
    const cam = stream();
    const sessions: string[] = [];
    await start(runs, Promise.resolve(cam.s), Promise.reject(new Error("CDN")), sessions);
    expect(cam.track.stop).toHaveBeenCalledOnce();
    expect(sessions).toEqual([]);
  });

  it("two overlapping starts and an unmount mid-start: every track is stopped (#1317)", async () => {
    const runs = mediaRun();
    const [a, b, c] = [stream(), stream(), stream()];
    const [ga, gb, gc] = [deferred<MediaStream>(), deferred<MediaStream>(), deferred<MediaStream>()];
    const sessions: string[] = [];
    const one = start(runs, ga.p, Promise.resolve(), sessions);
    const two = start(runs, gb.p, Promise.resolve(), sessions);
    gb.resolve(b.s); // the newer start wins first
    ga.resolve(a.s); // the older one's camera arrives late
    await Promise.all([one, two]);
    expect(a.track.stop).toHaveBeenCalledOnce();
    expect(b.track.stop).not.toHaveBeenCalled();
    expect(sessions).toEqual(["session"]);
    const three = start(runs, gc.p, Promise.resolve(), sessions); // stops b's run
    runs.stop(); // unmount before its camera opens
    gc.resolve(c.s);
    await three;
    expect(b.track.stop).toHaveBeenCalledOnce();
    expect(c.track.stop).toHaveBeenCalledOnce();
    expect(sessions).toEqual([]);
  });

  it("stop releases in reverse order, once", () => {
    const runs = mediaRun();
    const order: string[] = [];
    const run = runs.start();
    run.hold(() => order.push("camera"));
    run.hold(() => order.push("session"));
    runs.stop();
    runs.stop();
    expect(order).toEqual(["session", "camera"]);
  });
});
