"use client";
// The Options drawer (spec: options-panel): latency, effects and labels in one place on /, on the storage they already
// use. A native <dialog> with showModal(): it keeps Tab inside, closes on Esc, puts the focus back and makes the page
// behind inert, so ↑/↓ never reach the song list.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { LATENCY_MAX, LATENCY_MIN, loadLatencyOffset, saveLatencyOffset } from "../core/settings";
import { LABEL_SETTINGS, LABELS_KEY, labelSetting, type LabelSetting } from "../note-labels/labels";
import { DEFAULT_PREFS, getPrefs, savePrefs, subscribePrefs, type Prefs } from "../sound";
import { DEFAULT_PIANO_VOLUME, getPianoVolume, setPianoVolume, subscribePianoVolume } from "../laptop-sound/volume";
import {
  DEFAULT_RECORDING_VOLUME,
  getRecordingOffset,
  getRecordingVolume,
  RECORDING_OFFSET_MAX,
  RECORDING_OFFSET_MIN,
  setRecordingOffset,
  setRecordingVolume,
  subscribeRecordingOffset,
  subscribeRecordingVolume,
} from "../audio-track";
import styles from "./options-panel.module.css";

export const LABEL_NAMES: Record<LabelSetting, string> = { auto: "Auto", notes: "Note names", keys: "Laptop keys", off: "Off" };

// The row ↑/↓ moves to: one step, stopping at the ends.
export const rowStep = (index: number, delta: number, count: number) => Math.max(0, Math.min(count - 1, index + delta));

// The labels row's ←/→: the previous or next setting in note-labels' order, stopping at the ends.
export const labelStep = (s: LabelSetting, delta: number): LabelSetting =>
  LABEL_SETTINGS[rowStep(LABEL_SETTINGS.indexOf(s), delta, LABEL_SETTINGS.length)];

function storedLabels(): LabelSetting {
  try {
    return labelSetting(null, localStorage.getItem(LABELS_KEY));
  } catch {
    return "auto";
  }
}

function saveLabels(s: LabelSetting) {
  try {
    localStorage.setItem(LABELS_KEY, s);
  } catch {
    // storage blocked: /play falls back to Auto
  }
}

export interface OptionValues {
  latency: number;
  prefs: Prefs;
  labels: LabelSetting;
}

// laptop-sound's "Piano volume": the laptop piano's level, on its own store, so the effects mute doesn't touch it.
function PianoVolumeRow() {
  const volume = useSyncExternalStore(subscribePianoVolume, getPianoVolume, () => DEFAULT_PIANO_VOLUME);
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor="opt-piano-volume">
        Piano volume
      </label>
      <div className={styles.control}>
        <input
          id="opt-piano-volume"
          data-row
          data-testid="opt-piano-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setPianoVolume(Number(e.target.value))}
        />
        <output className={styles.value}>{Math.round(volume * 100)}%</output>
      </div>
    </div>
  );
}

// audio-track's "Recording volume": the level of a local song's own recording under /play, on its own store too.
function RecordingVolumeRow() {
  const volume = useSyncExternalStore(subscribeRecordingVolume, getRecordingVolume, () => DEFAULT_RECORDING_VOLUME);
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor="opt-recording-volume">
        Recording volume
      </label>
      <div className={styles.control}>
        <input
          id="opt-recording-volume"
          data-row
          data-testid="opt-recording-volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setRecordingVolume(Number(e.target.value))}
        />
        <output className={styles.value}>{Math.round(volume * 100)}%</output>
      </div>
    </div>
  );
}

// audio-track's "Recording offset" (golden-demo): moves the recording against the chart, for a sidecar a little off on
// this machine. The piano and the judge don't move. Positive plays the recording earlier.
function RecordingOffsetRow() {
  const offset = useSyncExternalStore(subscribeRecordingOffset, getRecordingOffset, () => 0);
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor="opt-recording-offset">
        Recording offset
      </label>
      <div className={styles.control}>
        <input
          id="opt-recording-offset"
          data-row
          data-testid="opt-recording-offset"
          type="range"
          min={RECORDING_OFFSET_MIN}
          max={RECORDING_OFFSET_MAX}
          step={5}
          value={offset}
          onChange={(e) => setRecordingOffset(Number(e.target.value))}
        />
        <output className={styles.value} data-testid="opt-recording-offset-value">
          {offset > 0 ? "+" : offset < 0 ? "\u2212" : ""}
          {Math.abs(offset)} ms
        </output>
      </div>
      {/* Which way it moves, in the label row's right slot (Latency's Calibrate link sits there), so the value cell
          keeps every row's width and the tracks line up. */}
      {offset !== 0 && <span className={styles.hint}>{offset > 0 ? "Plays early" : "Plays late"}</span>}
    </div>
  );
}

// The rows, in the spec's order. Each row's first control carries data-row, the target of ↑/↓.
export function OptionsRows({
  values,
  onLatency,
  onPrefs,
  onLabels,
  recording = false,
}: {
  values: OptionValues;
  onLatency(ms: number): void;
  onPrefs(p: Partial<Prefs>): void;
  onLabels(s: LabelSetting): void;
  recording?: boolean; // a song on this machine has a recording (audio-track): only then the Recording rows
}) {
  const { latency, prefs, labels } = values;
  const enterToggles = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.click();
    }
  };
  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="opt-latency">
          Latency offset
        </label>
        <div className={styles.control}>
          <input
            id="opt-latency"
            data-row
            type="range"
            min={LATENCY_MIN}
            max={LATENCY_MAX}
            step={1}
            value={latency}
            onChange={(e) => onLatency(Number(e.target.value))}
          />
          <output className={styles.value} data-testid="opt-latency-value">
            {latency} ms
          </output>
        </div>
        <Link href="/calibrate" className={styles.link}>
          Calibrate
        </Link>
      </div>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="opt-volume">
          Effects volume
        </label>
        <div className={styles.control}>
          <input
            id="opt-volume"
            data-row
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            onChange={(e) => onPrefs({ volume: Number(e.target.value) })}
          />
          <output className={styles.value}>{Math.round(prefs.volume * 100)}%</output>
        </div>
      </div>
      <PianoVolumeRow />
      {recording && <RecordingVolumeRow />}
      {recording && <RecordingOffsetRow />}
      <label className={styles.row}>
        <span className={styles.label}>Mute</span>
        <input data-row data-testid="opt-mute" type="checkbox" className={styles.check} checked={prefs.muted} onKeyDown={enterToggles} onChange={(e) => onPrefs({ muted: e.target.checked })} />
      </label>
      <label className={styles.row}>
        <span className={styles.label}>Miss sound</span>
        <input data-row type="checkbox" className={styles.check} checked={prefs.missCue} onKeyDown={enterToggles} onChange={(e) => onPrefs({ missCue: e.target.checked })} />
      </label>
      <div className={styles.row}>
        <span className={styles.label} id="opt-labels">
          Note labels
        </span>
        <div className={styles.segments} role="radiogroup" aria-labelledby="opt-labels">
          {LABEL_SETTINGS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === labels}
              data-row={s === labels ? "" : undefined}
              data-testid={`opt-labels-${s}`}
              tabIndex={s === labels ? 0 : -1}
              className={styles.segment}
              onClick={() => onLabels(s)}
              onKeyDown={(e) => {
                const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                onLabels(labelStep(labels, d));
              }}
            >
              {LABEL_NAMES[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// The Options button and its drawer. O toggles it from anywhere on the page; Esc closes it (the dialog's own).
// /play's start screen (duo-start) passes keys={false}, since O is a laptop piano key there, its own onLatency so the
// next take uses the new offset, and the start panels that belong in it (Connect lights, the MIDI status) as children.
export function OptionsDrawer({
  recording = false,
  keys = true,
  onLatency,
  children,
}: {
  recording?: boolean;
  keys?: boolean;
  onLatency?: (ms: number) => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
  const [latency, setLatency] = useState(0);
  const [labels, setLabels] = useState<LabelSetting>("auto");

  const open = () => {
    const d = ref.current;
    if (!d || d.open) return;
    setLatency(loadLatencyOffset()); // read each time it opens, so it shows what /play set
    setLabels(storedLabels());
    d.showModal();
    d.querySelector<HTMLElement>("[data-row]")?.focus();
  };
  const toggle = () => (ref.current?.open ? ref.current.close() : open());

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== "o" || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ↑/↓ move between rows, the sliders' own ↑/↓ included; the focus moves to the row's first control.
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-row]")];
    const at = rows.findIndex((r) => r === document.activeElement || r.closest(`.${styles.row}`)?.contains(document.activeElement));
    rows[rowStep(Math.max(0, at), e.key === "ArrowDown" ? 1 : -1, rows.length)]?.focus();
  };

  return (
    <>
      <button
        type="button"
        className={styles.open}
        onClick={open}
        title={keys ? "Options (O)" : undefined}
        aria-keyshortcuts={keys ? "O" : undefined}
        data-capture-hide
        data-testid="options-open"
      >
        Options
      </button>
      <dialog ref={ref} className={styles.drawer} onKeyDown={onKeyDown} aria-labelledby="options-title" data-testid="options">
        <header className={styles.head}>
          <h2 id="options-title" className={styles.title}>
            Options
          </h2>
          <button type="button" className={styles.close} onClick={() => ref.current?.close()} aria-label="Close options">
            Esc
          </button>
        </header>
        <OptionsRows
          values={{ latency, prefs, labels }}
          recording={recording}
          onLatency={(ms) => {
            setLatency(ms);
            if (onLatency) onLatency(ms); // saves it too
            else saveLatencyOffset(ms);
          }}
          onPrefs={(p) => savePrefs({ ...getPrefs(), ...p })}
          onLabels={(s) => {
            setLabels(s);
            saveLabels(s);
            // keep the focus on the chosen segment as the roving one moves
            requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-testid="opt-labels-${s}"]`)?.focus());
          }}
        />
        {children && <div className={styles.extra}>{children}</div>}
        <p className={styles.note}>{onLatency ? "Labels apply when you press Start." : `Latency, labels${recording ? " and the recording" : ""} apply from the next song.`}</p>
      </dialog>
    </>
  );
}
