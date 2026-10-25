"use client";
// The Lab's On trial gallery (specs: experiments, lab-gallery): an exhibition, one card per registry entry, groups in
// the order they first appear. The wall runs on unbroken (a one-card group would leave a hole); each label names its
// group (its kind chip, or the group's name where the issue gives no kind), and the group headings stay for screen
// readers. Only real needs get a chip: needing nothing is the quiet default. A card is a poster and a wall label (number, title, line, what it
// is and what it needs), and the whole plate is one real link to the experiment. Under it, Eric's verdict: Keep, Cut
// or Keep with a note, stamped on the poster and kept in this browser; "Copy verdicts" hands them to the planner.
// It reads the registry alone: adding an experiment never edits the Lab.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { experiments as registry, type Experiment } from ".";
import { labeled, needsNoneFirst, type Labeled } from "./gallery/labels";
import { readVerdicts, stamp, VERDICTS_KEY, verdictText, writeVerdicts, type Verdict, type Verdicts } from "./gallery/verdicts";
import styles from "./gallery.module.css";

export function groupsOf<T extends Experiment>(list: T[]): { group: string; entries: T[] }[] {
  const by = new Map<string, T[]>();
  for (const x of list) by.set(x.group, [...(by.get(x.group) ?? []), x]);
  return [...by].map(([group, entries]) => ({ group, entries }));
}

// The gallery's reading order: groups as they first appear, needs-nothing first within each.
export const galleryOrder = (list: Experiment[]): Labeled[] => groupsOf(labeled(list)).flatMap((g) => needsNoneFirst(g.entries));

const local = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

// The verdicts as the store's raw JSON, through useSyncExternalStore (as records/best.ts reads the records): the server
// and the first paint see none, another tab's save updates this one. `memory` is this visit's copy, so blocked
// storage still keeps them until the page closes.
const listeners = new Set<() => void>();
let memory = "{}";
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};
const snapshot = () => {
  try {
    return local()?.getItem(VERDICTS_KEY) ?? memory;
  } catch {
    return memory;
  }
};
const save = (next: Verdicts) => {
  memory = JSON.stringify(next);
  writeVerdicts(local(), next);
  listeners.forEach((f) => f());
};

const NEED_TEXT = { dgx: "DGX", camera: "camera", mic: "mic" } as const;

export function ExperimentsGallery({ experiments = registry }: { experiments?: Experiment[] }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const verdicts = useMemo(() => readVerdicts({ getItem: () => raw }), [raw]);
  const [said, setSaid] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => fallbackRef.current?.select(), [fallback]);
  if (!experiments.length) return null;

  // From the store, not this render's copy: two clicks before a re-render must both land.
  const put = (name: string, v: Verdict | undefined) => {
    const next = readVerdicts({ getItem: snapshot });
    if (v) next[name] = v;
    else delete next[name];
    save(next);
  };

  const decided = experiments.filter((x) => verdicts[x.name]).length;
  const copy = () => {
    const text = verdictText(experiments, verdicts, new Date());
    const done = () => (setFallback(null), setSaid(`Copied ${decided} of ${experiments.length} verdicts.`));
    const manual = () => (setFallback(text), setSaid("Couldn't reach the clipboard: the verdicts are selected below to copy."));
    try {
      navigator.clipboard.writeText(text).then(done, manual);
    } catch {
      manual();
    }
  };

  return (
    <section className={styles.gallery} id="on-trial" aria-labelledby="lab-experiments" data-testid="lab-experiments">
      <header className={styles.head}>
        <h2 id="lab-experiments" className={styles.title}>
          On trial
        </h2>
        <p className={styles.sub}>
          {experiments.length} on trial, each off until its button turns it on. Kept or cut after a look.
        </p>
        <div className={styles.tally}>
          <span className={styles.count}>
            {decided} / {experiments.length} judged
          </span>
          <button type="button" className={styles.copy} onClick={copy} data-testid="lab-copy-verdicts">
            Copy verdicts
          </button>
        </div>
      </header>
      <p className={styles.said} role="status" aria-live="polite" data-testid="lab-verdicts-said">
        {said}
      </p>
      {fallback !== null && <textarea ref={fallbackRef} className={styles.fallback} readOnly value={fallback} aria-label="Verdicts to copy" rows={6} />}
      <div className={styles.groups}>
        {groupsOf(galleryOrder(experiments)).map((g) => (
          <section key={g.group} className={styles.group} aria-labelledby={`x-${g.group}`}>
            <h3 id={`x-${g.group}`} className={styles.groupTitle}>
              {g.group}
            </h3>
            <ul className={styles.grid}>
              {g.entries.map((x) => (
                <Card key={x.name} x={x} verdict={verdicts[x.name]} put={(v) => put(x.name, v)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

const VOTES = [
  ["keep", "Keep"],
  ["cut", "Cut"],
  ["note", "Keep + note"],
] as const;

function Card({ x, verdict, put }: { x: Labeled; verdict: Verdict | undefined; put(v: Verdict | undefined): void }) {
  const mark = stamp(verdict);
  const pick = (v: Verdict["v"]) => put(verdict?.v === v ? undefined : v === "note" ? { v, note: "" } : { v });
  const noteId = `x-${x.name}-note`;
  return (
    <li className={styles.card} data-verdict={verdict?.v}>
      <Link href={x.href} className={styles.plate} data-testid={`x-${x.name}`}>
        <span className={styles.frame} data-poster={x.poster ? "" : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 800×450 WebP of 60 KB or less, lazy: nothing for next/image to do */}
          {x.poster && <img className={styles.poster} src={x.poster} alt="" aria-hidden width={800} height={450} loading="lazy" decoding="async" />}
          {x.needs?.includes("dgx") && (
            <span className={styles.dgx} aria-hidden>
              DGX
            </span>
          )}
          {mark && (
            <span className={styles.stamp} data-testid={`x-${x.name}-stamp`}>
              {mark}
            </span>
          )}
        </span>
        <span className={styles.label}>
          <span className={styles.no}>
            {x.issue ? `#${x.issue} · ` : ""}x={x.name}
          </span>
          <span className={styles.name}>{x.title}</span>
          <span className={styles.line}>{x.line}</span>
        </span>
      </Link>
      <p className={styles.chips}>
        <span className={styles.chip}>{x.kind ?? x.group}</span>
        {x.needs?.map((n) => (
          <span key={n} className={styles.chip} data-need={n}>
            needs {NEED_TEXT[n]}
          </span>
        ))}
      </p>
      <div className={styles.verdict} role="group" aria-label={`Verdict on ${x.title}`}>
        {VOTES.map(([v, text]) => (
          <button key={v} type="button" className={styles.vote} data-v={v} aria-pressed={verdict?.v === v} onClick={() => pick(v)} data-testid={`x-${x.name}-${v}`}>
            {text}
          </button>
        ))}
      </div>
      {verdict?.v === "note" && (
        <div className={styles.note}>
          <label htmlFor={noteId}>Note on {x.title}</label>
          <input
            id={noteId}
            type="text"
            value={verdict.note}
            maxLength={140}
            onChange={(e) => put({ v: "note", note: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), e.currentTarget.blur())} // Esc leaves the field, not the Lab
          />
        </div>
      )}
    </li>
  );
}
