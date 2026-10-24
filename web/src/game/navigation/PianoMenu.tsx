"use client";
import styles from "../options-panel/options-panel.module.css";
import { useSyncExternalStore } from "react";
import { midiDevice } from "../core/input";
import { menuInput, performMenuAction } from "./menu";
import { menuAllowed } from "./state";
import type { InputDevice } from "../../contracts";

let snapshot = { enabled: false, status: "Piano menu off" };
const listeners = new Set<() => void>();
const update = (value: typeof snapshot) => { snapshot = value; listeners.forEach(cb => cb()); };
export const subscribePianoMenu = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export const pianoMenuSnapshot = () => snapshot;
const serverSnapshot = { enabled: false, status: "Piano menu off" };
export const pianoMenuServerSnapshot = () => serverSnapshot;
let device: InputDevice | null = null;

export async function enablePianoMenu() {
  // Only called by the visible gesture control. Never prompt from an effect.
  if (device) return;
  update({ enabled: true, status: "Requesting piano permission…" });
  device = midiDevice(status => update({ ...snapshot, status }));
  const input = menuInput(() => snapshot.enabled && menuAllowed(window.location.pathname), performMenuAction);
  await device.start(input);
  if (snapshot.enabled && window.location.pathname === "/") document.querySelector<HTMLElement>('a[data-testid^="song-"][aria-current=true]')?.focus();
}
export function disablePianoMenu() {
  device?.stop(); device = null;
  update({ enabled: false, status: "Piano menu off" });
}

export function PianoMenuControls() {
  const state = useSyncExternalStore(subscribePianoMenu, pianoMenuSnapshot, () => serverSnapshot);
  return <section aria-label="Piano menu controls" className={styles.row}>
    <label className={styles.label} htmlFor="opt-piano-menu">Piano navigation</label>
    <input id="opt-piano-menu" aria-label="Piano navigation" data-row className={styles.check} type="checkbox" checked={state.enabled} onChange={() => state.enabled ? disablePianoMenu() : void enablePianoMenu()} />
    <small role="status" style={{ gridColumn: "1 / -1", color: "var(--pa-ink-dim)" }}>{state.status}</small>
    <small style={{ gridColumn: "1 / -1" }}>B2 Home · C3 Previous · D3 Next · E3 Select. Release between presses; off while playing.</small>
  </section>;
}
