// Real Keys (spec: real-keys): where the falling notes go. Each key's lane runs from the key bed's back edge (v = 0)
// away from the player (v < 0), through the same homography as the keys, so the notes recede in the camera's own
// perspective and land on the back edge at their time. Pure, so the geometry tests without a camera.
import type { H } from "./homography";

export const overlaySettings = {
  leadMs: 2400, // a note appears this long before its time
  maxDepth: 2.5, // the lane's length beyond the back edge, in bed depths
  horizonShare: 0.7, // never past this share of the way to the map's horizon, where the picture flips
  noteAlpha: 0.72,
  glowAlpha: 0.42,
  wrongMs: 220, // a wrong key's red tint
  wrongAlpha: 0.45,
};

// How far beyond the back edge the lanes may run: the map's denominator h6·u + h7·v + h8 must stay positive (the
// picture side of the horizon) across the bed's width.
export function laneDepth(m: H, s = overlaySettings): number {
  let depth = s.maxDepth;
  for (const u of [0, 0.5, 1]) {
    const w0 = m[6] * u + m[8]; // at v = 0
    if (m[7] > 0) depth = Math.min(depth, (s.horizonShare * w0) / m[7]); // w falls as v goes negative
  }
  return Math.max(0, depth);
}

// A note's lane span [far, near] in bed v at chart time nowMs, or null when it's not on screen: it enters at -depth
// leadMs before its time, lands on v = 0 at its time, and its tail (its duration) follows it in.
export function noteSpan(nowMs: number, atMs: number, durMs: number, depth: number, s = overlaySettings): [number, number] | null {
  const v = (ms: number) => (-(ms - nowMs) / s.leadMs) * depth;
  const near = Math.min(0, v(atMs)) || 0; // never -0
  const far = Math.max(-depth, v(atMs + durMs));
  return atMs + durMs < nowMs || atMs - nowMs > s.leadMs || far >= near ? null : [far, near];
}

// The video's picture inside the stage, as object-fit: contain lays it out: picture px → stage px.
export function containFit(videoW: number, videoH: number, boxW: number, boxH: number) {
  const scale = Math.min(boxW / videoW, boxH / videoH);
  return { scale, dx: (boxW - videoW * scale) / 2, dy: (boxH - videoH * scale) / 2 };
}

// MIDI events from the recorder's log, replayed in clip mode. t is ms from the recorder's start.
export interface LoggedNote {
  t: number;
  type: "on" | "off";
  pitch: number;
  velocity: number;
}

export function parseLog(raw: unknown): LoggedNote[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { notes?: unknown })?.notes) ? (raw as { notes: unknown[] }).notes : [];
  return list
    .filter((n): n is LoggedNote => !!n && Number.isFinite((n as LoggedNote).t) && Number.isFinite((n as LoggedNote).pitch))
    .map((n) => ({ t: n.t, type: n.type === "off" ? "off" : "on", pitch: n.pitch, velocity: n.velocity ?? 64 }))
    .sort((a, b) => a.t - b.t);
}
