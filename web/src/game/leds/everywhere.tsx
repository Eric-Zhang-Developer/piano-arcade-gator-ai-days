// The lights on every page (root layout): with the board on and Demo picked, every key pressed on the piano lights
// with its ripple, whatever page is open. A small Lights button by the top corner's Controls hint connects the board, flips Demo and shows
// whether the keyboard and the lights are there; /play has the same in its pause menu, so the button stays off it.
"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { captureOn } from "../capture-mode";
import { kitChip, Panel } from "../duo-tokens";
import { hideNav } from "../nav-bar/slots";
import { ConnectLights, DemoLights, lightModeNow, subscribeLightMode } from ".";
import { hintRamp, lightMode, pressKey } from "./messages";
import { autoConnect, linkState, send, subscribe, type LinkState } from "./serial";

type Midi = { inputs: Map<string, MidiInput>; onstatechange: unknown; addEventListener(t: "statechange", l: () => void): void };
type MidiInput = { name: string; addEventListener(t: "midimessage", l: (e: { data: Uint8Array }) => void): void; removeEventListener(t: "midimessage", l: (e: { data: Uint8Array }) => void): void };

// The piano's name, or null with none plugged in. MIDI is asked for only once it's wanted (Demo on with the board
// ready, or this panel open), so a page never prompts for it on its own. It listens with addEventListener, so the
// game's own handler (onmidimessage) is left alone, and sends a press only while Demo is on with the board ready.
function usePiano(wanted: boolean): string | null {
  const [piano, setPiano] = useState<string | null>(null);
  useEffect(() => {
    if (!wanted || typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) return;
    let gone = false;
    let wired: MidiInput[] = [];
    const onMessage = (e: { data: Uint8Array }) => {
      const m = linkState() === "ready" && lightModeNow() === 1 ? pressKey(e.data) : null;
      if (m) send(m);
    };
    const unwire = () => {
      for (const i of wired) i.removeEventListener("midimessage", onMessage);
      wired = [];
    };
    const wire = (midi: Midi) => {
      if (gone) return;
      unwire();
      wired = [...midi.inputs.values()];
      for (const i of wired) i.addEventListener("midimessage", onMessage);
      setPiano(wired[0]?.name ?? null);
    };
    (navigator as unknown as { requestMIDIAccess(): Promise<Midi> })
      .requestMIDIAccess()
      .then((midi) => {
        wire(midi);
        midi.addEventListener("statechange", () => wire(midi));
      })
      .catch(() => {});
    return () => {
      gone = true;
      unwire();
    };
  }, [wanted]);
  return piano;
}

const noop = () => () => {};

export function LightsEverywhere() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  const m = useSyncExternalStore(subscribeLightMode, lightModeNow, () => 0 as const);
  const capture = useSyncExternalStore(noop, captureOn, () => false);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const lit = s === "ready" && m === 1;
  const piano = usePiano(lit || open);
  useEffect(autoConnect, []);
  // A board that restarted is back in whatever it last saved: send the chosen mode on every connect.
  useEffect(() => {
    if (s === "ready") for (const msg of [hintRamp(), lightMode(m)]) send(msg);
  }, [s, m]);
  if (s === "unsupported" || capture || hideNav(pathname, false)) return null;
  return (
    <div data-testid="lights-everywhere" style={{ position: "fixed", right: 160, top: 38, zIndex: 40, display: "grid", gap: 8, justifyItems: "end" }}>
      <button
        type="button"
        data-testid="lights-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={kitChip(lit).className}
        style={kitChip(lit).style}
      >
        {s !== "ready" ? "Lights: off" : m === 1 ? "Lights: demo" : "Lights: learning"}
      </button>
      {open && (
        <Panel style={{ padding: 12, display: "grid", gap: 8, justifyItems: "start" }}>
          <span data-testid="lights-keyboard" style={kitChip(piano !== null).style}>
            Keyboard: {piano ?? "none plugged in"}
          </span>
          <span style={{ display: "flex" }}>
            <ConnectLights />
            <DemoLights />
          </span>
        </Panel>
      )}
    </div>
  );
}
