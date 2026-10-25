import type { Metadata } from "next";
import { JetBrains_Mono, Saira } from "next/font/google";
import { CaptureMode } from "../game/capture-mode";
import { GameBoundary } from "../game/crash-guard/boundary";
import { PhoneGuard } from "../game/phone-guard";
import { DemoReset } from "../game/demo-reset";
import { HelpOverlay } from "../game/help-overlay";
import { LaptopSound } from "../game/laptop-sound/install";
import "./globals.css";
import { APP_NAME } from "@/game/app-name";

// The display face (visual-direction.md), exposed as --pa-font-display only: the body stays system-ui. Duo: upright,
// variable weight, with the width axis so numerals can be condensed (font-stretch); italic isn't loaded.
const saira = Saira({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--pa-font-display",
});

// Duo's data face: labels, levels, bar numbers, ms and hints, in small monospace caps.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--pa-font-data",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "An arcade rhythm game played on a real piano",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${saira.variable} ${mono.variable}`}>
      <body>
        {/* crash-guard: a render error shows a card with a way back; only the page, so the keys outside keep working */}
        <GameBoundary>{children}</GameBoundary>
        {/* ?capture=1: no cursor or setup text while the video is recorded (capture-mode) */}
        {/* laptop-sound: its module wraps requestMIDIAccess as it loads, before any page asks for MIDI */}
        <LaptopSound />
        <CaptureMode />
        {/* ? opens a card of every control on / and /play, not mid-take (help-overlay) */}
        <HelpOverlay />
        {/* a phone or tablet on / or /play: a card saying it's made for a laptop or a piano (phone-guard) */}
        <PhoneGuard />
        {/* Shift+Esc loads / clean between judges, even from crash-guard's card (demo-reset) */}
        <DemoReset />
      </body>
    </html>
  );
}
