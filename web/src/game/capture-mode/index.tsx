"use client";
// Capture mode (spec: capture-mode): ?capture=1 hides the cursor, debug text and setup controls while the video is
// recorded, and changes nothing else. Elements opt in with data-capture-hide in their owners' files.
import { useEffect } from "react";

export const CAPTURE_KEY = "pianoArcade.capture";

// ?capture=1 on, ?capture=0 off; with neither, what this tab stored last.
export function isCapture(search: string, stored: string | null): boolean {
  const v = new URLSearchParams(search).get("capture");
  if (v === "1") return true;
  if (v === "0") return false;
  return stored === "1";
}

// For canvas code, which can't use the attribute: true while <html data-capture> is set.
export const captureOn = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-capture");

const CSS = `html[data-capture], html[data-capture] * { cursor: none !important; }
html[data-capture] [data-capture-hide] { display: none !important; }`;

// Mounted once in the root layout. The flag applies after hydration (no <head> script), so a recording starts once the
// page has loaded. Storage blocked: the URL alone decides.
export function CaptureMode() {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(CAPTURE_KEY);
    } catch {
      // blocked storage
    }
    const on = isCapture(window.location.search, stored);
    try {
      if (new URLSearchParams(window.location.search).has("capture")) sessionStorage.setItem(CAPTURE_KEY, on ? "1" : "0");
    } catch {
      // blocked storage
    }
    document.documentElement.toggleAttribute("data-capture", on);
  }, []);
  return <style>{CSS}</style>;
}
