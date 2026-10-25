// The results screen's layout (spec: results-layout). The first view is the ceremony: rank, counts, one featured
// panel and the buttons, with no scroll at 1280×720. Every other plugin panel is a card in the details grid below.
import Link from "next/link";
import type { ReactNode } from "react";
import type { GamePlugin, Results } from "../../contracts";
import { Slots } from "../play-slots/ui";
import { showsMoment } from "../record-moment/timing";
import { scoringVersion as policyFor } from "../core/sustain";
import { takeOutcome } from "../records";
import { Tally } from "../results-tally";
import styles from "./results-layout.module.css";

export const resultsLayoutSettings = {
  featured: ["record-moment", "take-graph"], // panels in the first view, under the counts (record-moment: NEW RECORD takes only)
  practiceFeatured: ["chunk-practice"], // a practice=1 take: chunk practice's way on in place of the graph (#294)
  newRecordFeatured: ["record-moment"], // a NEW RECORD take: the moment alone; at 1280×720 the graph pushed Retry off
  // the first view, so it moves to the details for that take (spec: record-moment, First view)
  demoFeatured: ["watch-demo"], // a demo=1 take: its way back to the songs, so its focused button scrolls nothing
  actions: ["piano-out", "wait-mode"], // panels that are buttons: they join Retry and Songs
  names: { "take-midi": "MIDI", "replay-view": "Replay", "weak-bars": "Phrases", "tempo-curve": "Tempo" } as Record<string, string>,
};

// A card's heading: the plugin's name, from its id unless names gives one ("chord-sync" → "Chord sync").
export function panelName(id: string): string {
  const name = resultsLayoutSettings.names[id] ?? id.replaceAll("-", " ");
  return name[0].toUpperCase() + name.slice(1);
}

// The first view's panels for this take: on a chunk-practice step, Next or "Learn again" with the rank.
export const featuredFor = (params: URLSearchParams, newRecord = false) =>
  params.get("practice") === "1"
    ? resultsLayoutSettings.practiceFeatured
    : params.get("demo") === "1"
      ? resultsLayoutSettings.demoFeatured
      : newRecord
        ? resultsLayoutSettings.newRecordFeatured
        : resultsLayoutSettings.featured;

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

export function ResultsLayout({
  results,
  title,
  scored,
  score,
  timing,
  plugins,
  panel,
  onRetry,
  settings,
  params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
  newRecord = showsMoment(takeOutcome()),
  scoringVersion = policyFor(params),
}: {
  results: Results;
  title?: string; // the song's title, over the rank
  scored: boolean; // false in wait mode: no rank, counts or timing
  score?: number; // the HUD's score; "—" when the page has none
  timing?: ReactNode; // the timing line, under the stats
  plugins: GamePlugin[]; // layers.ts order
  panel: (p: GamePlugin) => ReactNode; // a plugin's results panel, as Slots takes it
  onRetry: () => void;
  settings?: ReactNode; // latency, sound and MIDI controls: last, under the details
  params?: URLSearchParams; // the take's URL; /play's own when not given
  newRecord?: boolean; // this take set a new record (records' outcome when not given): record-moment's first view
  scoringVersion?: 1 | 2 | 3; // the take's scoring policy; the URL's when not given
}) {
  const { actions } = resultsLayoutSettings;
  const featured = featuredFor(params, newRecord);
  const only = (ids: string[]) => plugins.filter((p) => ids.includes(p.id));
  const rest = plugins.filter((p) => !featured.includes(p.id) && !actions.includes(p.id));
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
  return (
    <section data-testid="results" className={styles.results}>
      <div className={styles.ceremony}>
        {title && <p className={styles.song}>{title}</p>}
        {scored ? (
          <div className={styles.head}>
            <div data-testid="rank" className={styles.rank}>
              {results.rank}
            </div>
            <div className={styles.tally}>
              <dl className={styles.counts}>
                {countRows(results).map((r, i, rows) => (
                  <div key={r.id} className={styles.count} style={{ "--tone": r.tone } as React.CSSProperties}>
                    <dt>{r.label}</dt>
                    <dd>
                      <Tally value={r.value} index={i} of={rows.length} testid={r.id} />
                    </dd>
                  </div>
                ))}
              </dl>
              <dl className={styles.stats}>
                <div>
                  <dt>Score</dt>
                  <dd data-testid="score">{score === undefined ? "—" : score.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt>{results.sustain ? "Timing accuracy" : "Accuracy"}</dt>
                  <dd data-testid="accuracy">{(results.accuracy * 100).toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Max combo</dt>
                  <dd data-testid="max-combo">{results.maxCombo}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <h2 data-testid="unscored" className={styles.unscored}>
            Wait mode: not scored
          </h2>
        )}
        {scored && timing && <div className={styles.timing}>{timing}</div>}
        {scored && results.sustain && <section data-testid="sustain-results" aria-label="Hold completion" style={{ textAlign: "center", padding: 12 }}>
          <strong>Long-note hold bonus: {results.sustain.earnedPoints} / {results.sustain.possiblePoints} points</strong>
          <p>Timing grade stays separate. Hold marked notes through their tails, then release. Early releases earn partial credit; unconfirmed releases earn none. Extra time earns no extra points.</p>
          <small>Scoring v{scoringVersion} · timing points + confirmed hold bonus · separate v{scoringVersion} records</small>
        </section>}
        <div className={styles.featured}>
          <Slots plugins={only(featured)} panel={panel} />
        </div>
        <div className={styles.actions}>
          <button className={styles.retry} onClick={onRetry} autoFocus>
            Retry
          </button>
          <Slots plugins={only(actions)} panel={panel} />
          <Link href="/" className={styles.songs} aria-label="Home — song selection">
            Home
          </Link>
        </div>
        <a href="#results-details" className={styles.cue}>
          Details ↓
        </a>
      </div>
      <div id="results-details" className={styles.details}>
        <h2 className={styles.detailsName}>Details</h2>
        <div className={styles.grid}>
          <Slots plugins={rest} panel={card} />
        </div>
        {settings && <div className={styles.settings}>{settings}</div>}
      </div>
    </section>
  );
}
