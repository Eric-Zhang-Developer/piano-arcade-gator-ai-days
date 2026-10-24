"use client";
// The Options drawer (spec: options-panel): latency, effects and labels in one place on /, on the storage they already
// use. A native <dialog> with showModal(): it keeps Tab inside, closes on Esc, puts the focus back and makes the page
// behind inert, so ↑/↓ never reach the song list.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { LATENCY_MAX, LATENCY_MIN, loadLatencyOffset, saveLatencyOffset } from "../core/settings";
import { LABEL_SETTINGS, LABELS_KEY, labelSetting, type LabelSetting } from "../note-labels/labels";
import { DEFAULT_PREFS, getPrefs, savePrefs, subscribePrefs, type Prefs } from "../sound";
import { LobbyMusic } from "../navigation/LobbyMusic";
import { PianoMenuControls } from "../navigation/PianoMenu";
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

// The rows, in the spec's order. Each row's first control carries data-row, the target of ↑/↓.
export function OptionsRows({
  values,
  onLatency,
  onPrefs,
  onLabels,
}: {
  values: OptionValues;
  onLatency(ms: number): void;
  onPrefs(p: Partial<Prefs>): void;
  onLabels(s: LabelSetting): void;
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
export function OptionsDrawer() {
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
      <button type="button" className={styles.open} onClick={open} data-capture-hide data-testid="options-open">
        Options <kbd className={styles.kbd}>O</kbd>
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
          onLatency={(ms) => {
            setLatency(ms);
            saveLatencyOffset(ms);
          }}
          onPrefs={(p) => savePrefs({ ...getPrefs(), ...p })}
          onLabels={(s) => {
            setLabels(s);
            saveLabels(s);
            // keep the focus on the chosen segment as the roving one moves
            requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-testid="opt-labels-${s}"]`)?.focus());
          }}
        />
        <div className={styles.rows}><LobbyMusic /><PianoMenuControls /></div>
        <p className={styles.note}>Latency and labels apply from the next song.</p>
      </dialog>
    </>
  );
}
