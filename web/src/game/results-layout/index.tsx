// The results screen's layout (spec: results-layout), in the Duo bands (spec: duo-results). The first view, with no
// scroll at 1280×720: the rank in brackets with the six data cells, the featured panels (BY BAR and TIMING), then the
// tutor beside the buttons. Below it, the details (spec: duo-details): every other plugin panel as a bracketed card in
// two groups, How I played and Do something, with the settings in the Options drawer.
import Link from "next/link";
import type { ReactNode } from "react";
import type { GamePlugin, Results } from "../../contracts";
import { Brackets, Button, DataCell, MonoLabel, Panel } from "../duo-tokens";
import { FlowJudge } from "../flow-mode/judge";
import { playMode } from "../play-modes/modes";
import { OptionsDrawer } from "../options-panel";
import { Slots } from "../play-slots/ui";
import { showsMoment } from "../record-moment/timing";
import { takeOutcome } from "../records";
import { Tally } from "../results-tally";
import styles from "./results-layout.module.css";
import { useLandingLayout } from "../results-landing";

export const resultsLayoutSettings = {
  // panels in the first view, under the counts (record-moment: NEW RECORD takes only; flow-mode: its headline, Flow takes only)
  featured: ["flow-mode", "record-moment", "duo-results"], // duo-results: BY BAR and TIMING, the middle band
  ladder: ["play-modes"], // LEARN → FLOW → PERFORM, under the rank: the next mode is one click from the take
  tutor: ["duo-tutor"], // the bottom band: the tutor's line and PRACTICE BARS X–Y, beside Retry and Songs
  practiceFeatured: ["chunk-practice"], // a practice=1 or =adapt take: chunk practice's way on in place of the graph (#294)
  newRecordFeatured: ["record-moment"], // a NEW RECORD take: the moment alone; at 1280×720 the graph pushed Retry off
  // the first view, so it moves to the details for that take (spec: record-moment, First view)
  demoFeatured: ["watch-demo"], // a demo=1 take: its way back to the songs, so its focused button scrolls nothing
  actions: ["piano-out", "sheet-review", "score-card"], // panels that are buttons: they join Retry and Songs
  // The details, by what a player wants (spec: duo-details; specs/decisions/duo-details-groups.md). Timing leads How I
  // played; a panel in neither list joins the end of it, as duo-start does with a panel in no group.
  played: ["tempo-curve", "evenness", "dynamics", "take-graph", "bar-loop", "weak-bars", "chord-sync", "records"],
  doing: ["replay-view", "take-midi"], // panels that are buttons: one row of the kit's
  wide: ["take-graph"], // spans both columns: at half width the graph's 900-wide plot overflowed the card
  names: { "take-midi": "MIDI", "replay-view": "Replay", "weak-bars": "Phrases", "tempo-curve": "Tempo", "bar-loop": "Passes" } as Record<string, string>,
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
  onLatency,
  status,
  params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search),
  newRecord = showsMoment(takeOutcome()),
  heldTempo = playMode(params) === "flow" ? (FlowJudge.live?.heldTempo ?? null) : null,
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
  onLatency?: (ms: number) => void; // /play's own, so Retry uses an offset set in the Options drawer
  status?: ReactNode; // the MIDI status line, inside the Options drawer
  params?: URLSearchParams; // the take's URL; /play's own when not given
  newRecord?: boolean; // this take set a new record (records' outcome when not given): record-moment's first view
  heldTempo?: number | null; // a Flow take's held tempo, beside the rank, since it caps the rank (play-modes)
}) {
  const { actions } = resultsLayoutSettings;
  const featured = featuredFor(params, newRecord);
  const only = (ids: string[]) => plugins.filter((p) => ids.includes(p.id));
  const { played, doing, wide } = resultsLayoutSettings;
  const rest = plugins.filter((p) => ![...featured, ...actions, ...resultsLayoutSettings.tutor, ...resultsLayoutSettings.ladder, ...doing].includes(p.id));
  const rank = (id: string) => (played.includes(id) ? played.indexOf(id) : played.length);
  const playedPlugins = [...rest].sort((a, b) => rank(a.id) - rank(b.id)); // stable: unlisted panels keep layers.ts order
  const card = (name: string, node: ReactNode, span = false) => (
    <Brackets tone="line" style={{ height: "100%", boxSizing: "border-box" }}>
      <Panel style={{ height: "100%", boxSizing: "border-box" }}>
        <section className={styles.card} aria-label={name} data-wide={span || undefined}>
          <h3 className={styles.cardName}>{name}</h3>
          {node}
        </section>
      </Panel>
    </Brackets>
  );
  const pluginCard = (p: GamePlugin) => {
    const node = panel(p);
    return node === null || node === undefined ? node : card(panelName(p.id), node, wide.includes(p.id));
  };
  useLandingLayout(); // results-landing's first frame, before paint (a no-op without ?x=results-landing)
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
              {title && (
                <h1 className={styles.song}>
                  {title}
                  <span className={styles.srOnly}>, rank {results.rank}</span>
                </h1>
              )}
              {composer && <MonoLabel style={{ fontSize: 14, letterSpacing: "0.3em" }}>{composer}</MonoLabel>}
              <p className={styles.extra}>
                <MonoLabel>
                  Wrong <span className={styles.wrong}>✕ <Tally value={results.counts.wrong ?? 0} index={tallies - 2} of={tallies} testid="count-wrong" /></span>
                  {" · "}Extra <Tally value={results.counts.extra} index={tallies - 1} of={tallies} testid="count-extra" />
                  {" · "}Score <span data-testid="score">{score === undefined ? "—" : score.toLocaleString("en-US")}</span>
                  {heldTempo !== null && (
                    <>
                      {" · "}Tempo <span data-testid="held-tempo" className={styles.tempo}>{heldTempo}%</span>
                    </>
                  )}
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
            {title && <h1 className={styles.song}>{title}</h1>}
            <h2 data-testid="unscored" className={styles.unscored}>
              Learn: not scored
            </h2>
          </>
        )}
        <div className={styles.ladder}>
          <Slots plugins={only(resultsLayoutSettings.ladder)} panel={panel} />
        </div>
        <div className={styles.featured}>
          <Slots plugins={only(featured)} panel={panel} />
        </div>
        <Panel style={{ width: "100%", boxSizing: "border-box" }}>
          <div className={styles.bottom}>
            <div className={styles.tutor} data-landing-after>
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
        <div className={styles.groupHead}>
          <h2 className={styles.groupName}>How I played</h2>
          <OptionsDrawer keys={false} onLatency={onLatency} note="Latency and labels apply when you press Retry.">
            {status}
          </OptionsDrawer>
        </div>
        <div className={styles.grid} data-group="played">
          {scored && timing && <div data-testid="slot-timing">{card("Timing", timing)}</div>}
          <Slots plugins={playedPlugins} panel={pluginCard} />
        </div>
        <div className={styles.doing} data-group="doing">
          <h2 className={styles.groupName}>Do something</h2>
          <div className={styles.doingRow}>
            <Slots plugins={only(doing)} panel={panel} />
          </div>
        </div>
      </div>
    </section>
  );
}
