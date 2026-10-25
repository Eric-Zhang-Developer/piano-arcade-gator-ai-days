// musicbox-polish's Validation: the tab title, one audio context across cranks, and toggles that name their action.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "../../../app/musicbox/layout";
import { APP_NAME } from "../../app-name";
import { crankAudio } from "./crank-audio";
import { Toggles } from "./Pinned";

describe("the tab title (#1198)", () => {
  it("names the page", () => {
    expect(metadata.title).toBe(`Pinned · ${APP_NAME}`);
  });
});

describe("the crank's audio (#1199)", () => {
  function fakeContext() {
    const node = () => ({ connect() {}, disconnect() {}, gain: { value: 0 } });
    return { currentTime: 0, destination: {}, closed: false, resume: async () => {}, close: async function (this: { closed: boolean }) { this.closed = true; }, createGain: node };
  }
  it("crank, stop, crank: one context, reused, and closed when the page goes", () => {
    const made: ReturnType<typeof fakeContext>[] = [];
    const audio = crankAudio(() => { const c = fakeContext(); made.push(c); return c as unknown as AudioContext; });
    let stopped = 0;
    const pin = () => [{ stop: () => stopped++ } as unknown as AudioScheduledSourceNode];
    audio.start(0.5, pin);
    audio.stop();
    audio.start(0.5, pin);
    expect(made).toHaveLength(1);
    expect(stopped).toBe(1);
    audio.close();
    expect(stopped).toBe(2);
    expect(made[0].closed).toBe(true);
    expect(audio.ctx).toBeNull();
  });
});

describe("the toggles (#1200)", () => {
  const html = (playing: boolean, macro: boolean) =>
    renderToStaticMarkup(<Toggles playing={playing} macro={macro} onCrank={() => {}} onMacro={() => {}} crankOff={false} macroOff={false} />);
  it("label the action they take, with no pressed state", () => {
    for (const [playing, macro] of [[false, false], [true, true]]) {
      const h = html(playing, macro);
      expect(h).not.toContain("aria-pressed");
      // Both labels sit in the button so it keeps its width; the idle one is marked and hidden.
      expect(h).toMatch(playing ? /data-idle="true">Turn the crank<\/span><span>Stop/ : /<span>Turn the crank<\/span><span data-idle="true">Stop/);
      expect(h).toMatch(macro ? /data-idle="true">Macro<\/span><span>Wide/ : /<span>Macro<\/span><span data-idle="true">Wide/);
    }
  });
  it("no type under 12 px on the page", () => {
    for (const f of ["Pinned.tsx", "pinned.module.css"]) {
      const text = readFileSync(new URL(f, import.meta.url), "utf8");
      const fonts = [...text.matchAll(/font(?:-size|Size)?\s*:\s*[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
      expect(fonts.filter((n) => n < 12), f).toEqual([]);
    }
  });
});
