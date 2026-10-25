import type { Metadata } from "next";
import { IBM_Plex_Mono, VT323 } from "next/font/google";
import styles from "../operator/operator.module.css";
import { APP_NAME } from "@/game/app-name";

const body = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--op-body" });
const display = VT323({ subsets: ["latin"], weight: "400", variable: "--op-display" });

export const metadata: Metadata = {
  title: `Attract mode · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

// operator-board's dark-field look, borrowed (read-only) so the two pages are one cabinet.
export default function AttractLayout({ children }: LayoutProps<"/attract">) {
  return <div className={`${styles.root} ${body.variable} ${display.variable}`}>{children}</div>;
}
