import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { labelStep, OptionsRows, rowStep } from ".";

const render = (latency: number, prefs = { volume: 0.35, muted: true, missCue: false }, labels = "off" as const) =>
  renderToStaticMarkup(<OptionsRows values={{ latency, prefs, labels }} onLatency={() => {}} onPrefs={() => {}} onLabels={() => {}} />);

test("stored values render: latency, volume, mute, miss sound and labels", () => {
  const html = render(-12);
  expect(html).toMatch(/data-testid="opt-latency-value">-12(<!-- -->)? ms</);
  expect(html).toMatch(/id="opt-latency"[^>]*value="-12"/);
  expect(html).toMatch(/>35(<!-- -->)?%</);
  expect(html).toMatch(/id="opt-piano-volume"[^>]*value="0.7"/); // laptop-sound's default, apart from the effects
  expect(html).toMatch(/data-testid="opt-mute"[^>]*checked=""/);
  expect(html).toMatch(/aria-checked="true"[^>]*data-testid="opt-labels-off"/);
  // the rows in the spec's order
  const order = ["Latency offset", "Effects volume", "Piano volume", "Mute", "Miss sound", "Note labels"].map((t) => html.indexOf(t));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("Recording volume shows only when a song has a recording, after Piano volume", () => {
  expect(render(0)).not.toMatch(/Recording volume/);
  const html = renderToStaticMarkup(
    <OptionsRows values={{ latency: 0, prefs: { volume: 0.35, muted: false, missCue: false }, labels: "off" }} onLatency={() => {}} onPrefs={() => {}} onLabels={() => {}} recording />,
  );
  expect(html).toMatch(/id="opt-recording-volume"[^>]*value="0.7"/); // audio-track's default
  expect(html.indexOf("Piano volume")).toBeLessThan(html.indexOf("Recording volume"));
  expect(html.indexOf("Recording volume")).toBeLessThan(html.indexOf("Mute"));
});

test("Recording offset shows only with a recording, after Recording volume, at 0 ms until set", () => {
  expect(render(0)).not.toMatch(/Recording offset/);
  const html = renderToStaticMarkup(
    <OptionsRows values={{ latency: 0, prefs: { volume: 0.35, muted: false, missCue: false }, labels: "off" }} onLatency={() => {}} onPrefs={() => {}} onLabels={() => {}} recording />,
  );
  expect(html).toMatch(/id="opt-recording-offset"[^>]*min="-300"[^>]*max="300"[^>]*value="0"/);
  expect(html.indexOf("Recording volume")).toBeLessThan(html.indexOf("Recording offset"));
  expect(html.indexOf("Recording offset")).toBeLessThan(html.indexOf("Mute"));
});

test("row movement stops at the ends", () => {
  expect(rowStep(0, -1, 5)).toBe(0);
  expect(rowStep(4, 1, 5)).toBe(4);
  expect(rowStep(2, 1, 5)).toBe(3);
});

test("labels step through note-labels' order and stop at the ends", () => {
  expect(labelStep("auto", -1)).toBe("auto");
  expect(labelStep("auto", 1)).toBe("notes");
  expect(labelStep("off", 1)).toBe("off");
  expect(labelStep("off", -1)).toBe("keys");
});
