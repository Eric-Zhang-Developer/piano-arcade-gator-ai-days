"use client";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { midiDevice } from "../core/input";
import { menuInput, performMenuAction } from "./menu";
import { menuAllowed, navigationPhase, subscribePhase } from "./state";
import type { InputDevice } from "../../contracts";

let snapshot = { enabled: false, status: "Piano menu off" };
const listeners = new Set<() => void>();
const update = (value: typeof snapshot) => { snapshot = value; listeners.forEach(cb => cb()); };
export const subscribePianoMenu = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export const pianoMenuSnapshot = () => snapshot;
const serverSnapshot = { enabled: false, status: "Piano menu off" };
export const pianoMenuServerSnapshot = () => serverSnapshot;
const noSubscription = () => () => {};
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
  return <section aria-label="Piano menu controls" style={{ width: "100%", font: "12px/1.5 system-ui" }}>
    <button onClick={() => state.enabled ? disablePianoMenu() : void enablePianoMenu()}>{state.enabled ? "Disable piano menu" : "Enable piano menu"}</button>
    <span role="status" style={{ marginLeft: 8 }}>{state.status}</span>
    <div>B2 Home/close · C3 Previous · D3 Next · E3 Select</div>
    <small>One press per action. Menu keys are off during countdown and playing.</small>
  </section>;
}

export function PianoMenuOverlay() {
  const path = usePathname();
  const top = useSyncExternalStore(noSubscription, () => window.top === window.self, () => false);
  const phase = useSyncExternalStore(subscribePhase, navigationPhase, () => "ready");
  if (!top || path !== "/play" || phase === "playing") return null;
  return <aside style={{ position: "fixed", bottom: 12, left: 12, maxWidth: 320, zIndex: 3000, padding: 10, borderRadius: 6, background: "#141022", color: "#f2f2f5" }}><PianoMenuControls /></aside>;
}
