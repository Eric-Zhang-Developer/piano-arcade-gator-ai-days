// The results screen's layout (spec: results-layout), in the Duo bands (spec: duo-results). The first view, with no
// scroll at 1280×720: the rank in brackets with the six data cells, the featured panels (BY BAR and TIMING), then the
// tutor beside the buttons. Every other plugin panel is a card in the details grid below.
import Link from "next/link";
import type { ReactNode } from "react";
import type { GamePlugin, Results } from "../../contracts";
import { Brackets, Button, DataCell, MonoLabel, Panel } from "../duo-tokens";
import { Slots } from "../play-slots/ui";
import { showsMoment } from "../record-moment/timing";
import { takeOutcome } from "../records";
import { Tally } from "../results-tally";
import styles from "./results-layout.module.css";

export const resultsLayoutSettings = {
  // panels in the first view, under the counts (record-moment: NEW RECORD takes only; flow-mode: its headline, Flow takes only)
  featured: ["flow-mode", "record-moment", "duo-results"], // duo-results: BY BAR and TIMING, the middle band
  tutor: ["duo-tutor"], // the bottom band: the tutor's line and PRACTICE BARS X–Y, beside Retry and Songs
  practiceFeatured: ["chunk-practice"], // a practice=1 or =adapt take: chunk practice's way on in place of the graph (#294)
  newRecordFeatured: ["record-moment"], // a NEW RECORD take: the moment alone; at 1280×720 the graph pushed Retry off
  // the first view, so it moves to the details for that take (spec: record-moment, First view)
  demoFeatured: ["watch-demo"], // a demo=1 take: its way back to the songs, so its focused button scrolls nothing
  actions: ["piano-out", "wait-mode", "sheet-review", "score-card"], // panels that are buttons: they join Retry and Songs
  names: { "take-midi": "MIDI", "replay-view": "Replay", "weak-bars": "Phrases", "tempo-curve": "Tempo" } as Record<string, string>,
};

// A card's heading: the plugin's name, from its id unless names gives one ("chord-sync" → "Chord sync").
export function panelName(id: string): string {
  const name = resultsLayoutSettings.names[id] ?? id.replaceAll("-", " ");
  return name[0].toUpperCase() + name.slice(1);
}

// The first view's panels for this take: on a chunk-practice step (the fixed walk, or adaptive-chunks'), its way on
// with the rank.
export const featuredFor = (params: URLSearchParams, newRecord = false) =>
  ["1", "adapt"].includes(params.get("practice") ?? "")
    ? resultsLayoutSettings.practiceFeatured
    : params.get("demo") === "1"
      ? resultsLayoutSettings.demoFeatured
      : newRecord
        ? resultsLayoutSettings.newRecordFeatured
        : resultsLayoutSettings.featured;

// Every count with its tone, for score-card's PNG (the screen's cells are dataCells below).
export function countRows(results: Results): { label: string; id: string; value: number; tone: string }[] {
  const { counts } = results;
  return [
    { label: "Perfect", id: "count-PERFECT", value: counts.PERFECT, tone: "var(--pa-gold)" },
    { label: "Great", id: "count-GREAT", value: counts.GREAT, tone: "#5ef2c4" }, // the HUD's GREAT: no token of its own
    { label: "Good", id: "count-GOOD", value: counts.GOOD ?? 0, tone: "var(--pa-good)" },
    { label: "Miss", id: "count-MISS", value: counts.MISS, tone: "var(--pa-miss)" },
    { label: "Wrong", id: "count-wrong", value: counts.wrong ?? 0, tone: "var(--pa-wrong)" },
    { label: "Extra", id: "count-extra", value: counts.extra, tone: "var(--pa-ink-dim)" },
  ];
}

// The top band's six data cells (spec: duo-results). Gold and grey only on the judgment numbers PERFECT and MISS;
// MAX COMBO in primary, the rest in ink. Their testids are the ones verify scripts and rank-stamp read.
export function dataCells(results: Results): { label: string; id: string; value: number | string; tone?: string; tally?: true }[] {
  const { counts } = results;
  return [
    { label: "Perfect", id: "count-PERFECT", value: counts.PERFECT, tone: "var(--pa-gold)", tally: true },
    { label: "Great", id: "count-GREAT", value: counts.GREAT, tally: true },
    { label: "Good", id: "count-GOOD", value: counts.GOOD ?? 0, tally: true },
    { label: "Miss", id: "count-MISS", value: counts.MISS, tone: "var(--pa-miss)", tally: true },
    { label: "Acc", id: "accuracy", value: `${(results.accuracy * 100).toFixed(1)}%` },
    { label: "Max combo", id: "max-combo", value: results.maxCombo, tone: "var(--pa-primary)" },
  ];
}

export function ResultsLayout({
  results,
  title,
  composer,
  scored,
  score,
  timing,
  plugins,
  panel,
  onRetry,
  settings,
  params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
  newRecord = showsMoment(takeOutcome()),
}: {
  results: Results;
  title?: string; // the song's title, beside the rank
  composer?: string; // under the title
  scored: boolean; // false in wait mode: no rank, counts or timing
  score?: number; // the HUD's score; "—" when the page has none
  timing?: ReactNode; // the timing text and latency button: the first card in the details (TIMING's histogram is up top)
  plugins: GamePlugin[]; // layers.ts order
  panel: (p: GamePlugin) => ReactNode; // a plugin's results panel, as Slots takes it
  onRetry: () => void;
  settings?: ReactNode; // latency, sound and MIDI controls: last, under the details
  params?: URLSearchParams; // the take's URL; /play's own when not given
  newRecord?: boolean; // this take set a new record (records' outcome when not given): record-moment's first view
}) {
  const { actions } = resultsLayoutSettings;
  const featured = featuredFor(params, newRecord);
  const only = (ids: string[]) => plugins.filter((p) => ids.includes(p.id));
  const rest = plugins.filter((p) => ![...featured, ...actions, ...resultsLayoutSettings.tutor].includes(p.id));
  const card = (p: GamePlugin) => {
    const node = panel(p);
    if (node === null || node === undefined) return node;
    return (
      <section className={styles.card} aria-label={panelName(p.id)}>
        <h3 className={styles.cardName}>{panelName(p.id)}</h3>
        {node}
      </section>
    );
  };
  const tutor = only(resultsLayoutSettings.tutor);
  const tallies = dataCells(results).filter((c) => c.tally).length + 2; // the cells, then WRONG and EXTRA
  return (
    <section data-testid="results" className={styles.results}>
      <div className={styles.ceremony}>
        {scored ? (
          <header className={styles.top}>
            <Brackets style={{ flexShrink: 0 }}>
              <div data-testid="rank" className={styles.rank}>
                {results.rank}
              </div>
            </Brackets>
            <div className={styles.name}>
              {title && <p className={styles.song}>{title}</p>}
              {composer && <MonoLabel style={{ fontSize: 14, letterSpacing: "0.3em" }}>{composer}</MonoLabel>}
              <p className={styles.extra}>
                <MonoLabel>
                  Wrong <span className={styles.wrong}>✕ <Tally value={results.counts.wrong ?? 0} index={tallies - 2} of={tallies} testid="count-wrong" /></span>
                  {" · "}Extra <Tally value={results.counts.extra} index={tallies - 1} of={tallies} testid="count-extra" />
                  {" · "}Score <span data-testid="score">{score === undefined ? "—" : score.toLocaleString("en-US")}</span>
                </MonoLabel>
              </p>
            </div>
            <div className={styles.cells}>
              {dataCells(results).map((c, i) => (
                <Brackets key={c.id} tone="line" style={{ padding: 0 }}>
                  <DataCell
                    label={c.label}
                    tone={c.tone}
                    size={48}
                    style={{ borderLeft: "none", padding: "12px 16px" }}
                    value={c.tally ? <Tally value={c.value as number} index={i} of={tallies} testid={c.id} /> : <span data-testid={c.id}>{c.value}</span>}
                  />
                </Brackets>
              ))}
            </div>
          </header>
        ) : (
          <>
            {title && <p className={styles.song}>{title}</p>}
            <h2 data-testid="unscored" className={styles.unscored}>
              Wait mode: not scored
            </h2>
          </>
        )}
        <div className={styles.featured}>
          <Slots plugins={only(featured)} panel={panel} />
        </div>
        <Panel style={{ width: "100%", boxSizing: "border-box" }}>
          <div className={styles.bottom}>
            <div className={styles.tutor}>
              <Slots plugins={tutor} panel={panel} />
            </div>
            <div className={styles.actions}>
              <Button kind="secondary" onClick={onRetry} autoFocus>
                Retry
              </Button>
              <Slots plugins={only(actions)} panel={panel} />
              <Link href="/">
                Songs
              </Link>
            </div>
          </div>
        </Panel>
        <a href="#results-details" className={styles.cue}>
          Details ↓
        </a>
      </div>
      <div id="results-details" className={styles.details}>
        <h2 className={styles.detailsName}>Details</h2>
        <div className={styles.grid}>
          {scored && timing && (
            <div data-testid="slot-timing" style={{ marginTop: 16 }}>
              <section className={styles.card} aria-label="Timing">
                <h3 className={styles.cardName}>Timing</h3>
                {timing}
              </section>
            </div>
          )}
          <Slots plugins={rest} panel={card} />
        </div>
        {settings && <div className={styles.settings}>{settings}</div>}
      </div>
    </section>
  );
}
