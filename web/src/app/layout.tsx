import type { Metadata } from "next";
import { Saira } from "next/font/google";
import { CaptureMode } from "../game/capture-mode";
import "./globals.css";

// The display face (visual-direction.md), exposed as --pa-font-display only: the body stays system-ui.
const saira = Saira({
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--pa-font-display",
});

export const metadata: Metadata = {
  title: "Piano Arcade",
  description: "An arcade rhythm game played on a real piano",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={saira.variable}>
      <body>
        {children}
        {/* ?capture=1: no cursor or setup text while the video is recorded (capture-mode) */}
        <CaptureMode />
      </body>
    </html>
  );
}
