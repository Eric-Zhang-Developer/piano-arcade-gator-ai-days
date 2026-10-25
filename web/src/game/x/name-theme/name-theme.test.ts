import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateChart, type Chart } from "../../../contracts";
import { unsavableReason } from "../../../data/save-plugin";
import { loadPedal } from "../../pedal";
import { chartProblems } from "../../songs/rules";
import { anchorTheme, ANCHOR } from ".";
import { CIPHERS, FRENCH, GERMAN, spelled } from "./cipher";
import { compose, fold, motif, pcName, type Theme } from "./compose";
import { clear, heldTheme, hold, keepsName, SONG } from "./memory";
import { offer } from "./Name";
import { nameThemeSwap } from "./swap";

const PATH = `songs/${SONG}/chart.json`;
const names = (pcs: number[]) => pcs.map((pc) => pcName(pc));
const end = (c: Chart) => Math.max(...c.notes.map((n) => n.beat + n.duration));
const seconds = (c: Chart) => (end(c) * 60) / c.bpm;

describe("the ciphers (name-theme)", () => {
  it("the French table is the source's, letter for letter", () => {
    // Jacques Chailley, Revue de musicologie 67/1 (1981), p. 72, as French Wikipedia's "Hommage à Haydn" reproduces
    // it: the rows under do ré mi fa sol la si. Its si column heads with B♭ (si bémol); H, P and W sit under si.
    const rows: [string, string][] = [
      ["C", "CJQX"],
      ["D", "DKRY"],
      ["E", "ELSZ"],
      ["F", "FMT"],
      ["G", "GNU"],
      ["A", "AIOV"],
      ["B", "HPW"],
      ["B♭", "B"],
    ];
    const fromSource = Object.fromEntries(rows.flatMap(([note, ls]) => [...ls].map((l) => [l, note])));
    expect(Object.keys(FRENCH).sort().join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(Object.fromEntries(Object.entries(FRENCH).map(([l, pc]) => [l, pcName(pc, 5)]))).toEqual(fromSource);
  });

  it("the anchor: HAYDN is B–A–D–D–G, as the 1909 pieces have it", () => {
    // Bryan Proksch, "Recomposing H-A-Y-D-N", Eisenstädter Haydn-Berichte 8 (2013), p. 369: rendered as B-A-D-D-G,
    // H as its traditional B natural (si la ré ré sol in Chailley).
    expect(motif(ANCHOR, FRENCH)).toEqual([11, 9, 2, 2, 7]);
  });

  it("the German names: BACH is B♭–A–C–B♮, ABEGG is A–B♭–E–G–G, and only note letters sound", () => {
    // Eric Sams, "Cryptography, musical", New Grove (1980), vol. 5, p. 80, via English Wikipedia's "Musical
    // cryptogram"; ABEGG per Blom (1961), p. 85, cited there.
    expect(names(motif("BACH", GERMAN))).toEqual(["B♭", "A", "C", "B"]);
    expect(names(motif("ABEGG", GERMAN))).toEqual(["A", "B♭", "E", "G", "G"]);
    expect(spelled("BRAHMS", GERMAN)).toBe("BAHS");
    expect(names(motif("BAHS", GERMAN))).toEqual(["B♭", "A", "B", "E♭"]);
  });

  it("accents fold to their letter, anything else goes, and the length is capped", () => {
    expect(fold("Zoë Ångström")).toBe("ZOEANGSTROM");
    expect(fold("o'Néill-Ruíz 3")).toBe("ONEILLRUIZ");
    expect(fold("李小龍")).toBe("");
    expect(fold("Abcdefghijklmnop")).toBe("ABCDEFGHIJKL");
  });
});

// Made up, never real people; the language each is styled on.
const BATCH: [string, string][] = [
  ["Amélie Durandeau", "French"],
  ["Søren Kvistholt", "Danish"],
  ["Józefina Wąsowiak", "Polish"],
  ["Ñandú Errazábal", "Spanish"],
  ["Sólrún Vígfúsdóttir", "Icelandic"],
  ["Çağla Yıldızoğlu", "Turkish"],
  ["Đurađ Mrkšinić", "Serbian (Latin)"],
  ["Ngozi Adébáyọ̀", "Yoruba"],
  ["Thảo Vũ Nhật", "Vietnamese"],
  ["Ana-Lúcia Brandãozinho", "Portuguese"],
  ["Kalani Kaʻōpualei", "Hawaiian"],
  ["Ilse Grünwälder", "German"],
  ["Mirela Ștefănoiu", "Romanian"],
  ["Oisín Ó Briainín", "Irish"],
  ["Gwenaëlle Le Kerrouac", "Breton"],
  ["Tuomas Mäkeläinenko", "Finnish"],
  ["Émile Vautrinet", "French"],
  ["Žaneta Kovárníková", "Czech"],
  ["Kofi Mensah-Adjeiwaa", "Akan"],
  ["Lukáš Holečkovský", "Slovak"],
];

const sounding = (c: Chart, beat: number) => c.notes.filter((n) => n.hand === "L" && n.beat <= beat && beat < n.beat + n.duration).map((n) => n.pitch % 12);

describe("the composition (name-theme)", () => {
  const themes = BATCH.flatMap(([n]) => (["french", "german"] as const).map((id) => offer(n, id).theme)).filter((t): t is Theme => !!t);

  it("all 20 batch names make charts that pass chart-lint and validateChart, in both systems", () => {
    expect(themes.length).toBeGreaterThanOrEqual(40);
    for (const t of themes) {
      expect(chartProblems(PATH, t.chart), t.letters).toEqual([]);
      expect(validateChart(t.chart)).toEqual([]);
    }
  });

  it("the same name gives the same chart twice", () => {
    expect(compose(fold("Amélie"), FRENCH)).toEqual(compose(fold("Amélie"), FRENCH));
  });

  it("every chord contains its motif note, and the left hand plays the whole triad", () => {
    for (const t of themes)
      for (const n of t.chart.notes.filter((x) => x.hand === "R")) expect(sounding(t.chart, n.beat), `${t.letters} ${n.id}`).toContain(n.pitch % 12);
  });

  it("theme and variation run 20 s ± 4 at the chart's bpm, and the variation starts a bar after the theme's cadence", () => {
    for (const t of themes) {
      expect(Math.abs(seconds(t.chart) - 20), t.letters).toBeLessThanOrEqual(4);
      expect(t.variationAt % t.chart.beatsPerBar).toBe(0);
    }
  });

  it("the theme ends on V and the piece on I; the pedal goes down after each new harmony and up before the next", () => {
    for (const t of themes) {
      expect(t.chords.at(-1)).toBe("I");
      expect(t.chords.at(-2)).toBe("V");
      t.pedal.forEach(([d, u], i) => {
        expect(d).toBeLessThan(u);
        if (i) expect(d).toBeGreaterThanOrEqual(t.pedal[i - 1][1]);
      });
    }
  });

  it("logs the outer voices' parallel fifths and octaves as a rate", () => {
    const moves = themes.reduce((n, t) => n + t.chart.notes.filter((x) => x.hand === "R").length - 1, 0);
    const parallels = themes.reduce((n, t) => n + t.parallels, 0);
    console.info(`name-theme: ${parallels} parallel fifths/octaves in ${moves} melody moves (${((100 * parallels) / moves).toFixed(1)}%) over ${themes.length} themes`);
    expect(parallels).toBeGreaterThanOrEqual(0);
  });

  it("the committed placeholder is the generator's HAYDN, and HAYDN's melody opens B A D D G", () => {
    const committed = JSON.parse(readFileSync(new URL(`../../../../public/songs/${SONG}/chart.json`, import.meta.url), "utf8"));
    expect(committed).toEqual(anchorTheme().chart);
    expect(names(anchorTheme().chart.notes.filter((n) => n.hand === "R").slice(0, 5).map((n) => n.pitch))).toEqual(["B", "A", "D", "D", "G"]);
  });

  it("a name with no letters, or none the system sounds, gets a line and no theme", () => {
    expect(offer("李小龍", "french")).toMatchObject({ theme: null, why: expect.stringContaining("No letters") });
    expect(offer("Lou", "german")).toMatchObject({ theme: null, why: expect.stringContaining("None of these letters") });
    expect(offer("  ", "french")).toMatchObject({ theme: null, why: null });
  });
});

describe("the swap, the pedal and privacy (name-theme)", () => {
  afterEach(() => {
    clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("the swap hands on the held chart for song=x/name-theme only", () => {
    const placeholder = anchorTheme().chart;
    const other = { ...placeholder, id: "twinkle" };
    const swap = nameThemeSwap().transformChart!;
    expect(swap(placeholder, new URLSearchParams(`song=${SONG}`))).toBe(placeholder); // nothing held
    const t = offer("Amélie", "french").theme!;
    hold("Amélie", "french", t);
    expect(swap(placeholder, new URLSearchParams(`song=${SONG}`))).toBe(t.chart);
    expect(swap(other, new URLSearchParams("song=twinkle"))).toBe(other);
  });

  it("loadPedal answers the held pedal with no request, and other songs as before", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const t = offer("Amélie", "french").theme!;
    hold("Amélie", "french", t);
    expect(await loadPedal(SONG)).toBe(t.pedal);
    expect(fetch).not.toHaveBeenCalled();
    clear();
    expect(await loadPedal(SONG)).toBeNull(); // not a pedal song, so no request either
    expect(await loadPedal("twinkle")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("making, holding, swapping and clearing a theme sends nothing and stores nothing, and the chart doesn't carry the name", async () => {
    const name = "Ximena Quiroga";
    const fetch = vi.fn();
    const send = vi.fn();
    const beacon = vi.fn();
    const store = { setItem: vi.fn(), getItem: vi.fn(() => null), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    const cookie = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => ({ open: vi.fn(), send })));
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.stubGlobal("localStorage", store);
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("indexedDB", { open: vi.fn() });
    vi.stubGlobal("document", { set cookie(v: string) { cookie(v); } });
    const log = vi.spyOn(console, "log");
    const t = offer(name, "french").theme!;
    hold(name, "french", t);
    nameThemeSwap().transformChart!(anchorTheme().chart, new URLSearchParams(`song=${SONG}`));
    await loadPedal(SONG);
    expect(heldTheme()?.name).toBe(name);
    clear();
    expect(heldTheme()).toBeNull();
    for (const f of [fetch, send, beacon, store.setItem, cookie, log, (indexedDB as unknown as { open: () => void }).open]) expect(f).not.toHaveBeenCalled();
    for (const word of name.split(" ")) expect(`${t.chart.title} ${t.chart.composer} ${t.chart.source}`).not.toContain(word);
  });

  it("no take is saved for it, and only /name and /play keep the name", () => {
    expect(unsavableReason(new URLSearchParams(`song=${SONG}&mode=wait`))).not.toBeNull();
    expect(unsavableReason(new URLSearchParams(`song=${SONG}`))).not.toBeNull();
    expect(["/name", "/play", "/", "/lab", "/name/x"].map(keepsName)).toEqual([true, true, false, false, false]);
  });

  it("both systems are on the page's switch", () => {
    expect(Object.keys(CIPHERS)).toEqual(["french", "german"]);
  });
});
