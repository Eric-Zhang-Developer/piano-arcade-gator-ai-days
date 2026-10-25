import type { Metadata } from "next";
import { APP_NAME } from "@/game/app-name";

// The page is a client component, so its tab title lives here (#953).
export const metadata: Metadata = { title: `Calibrate latency · ${APP_NAME}` };

export default function CalibrateLayout({ children }: LayoutProps<"/calibrate">) {
  return children;
}
