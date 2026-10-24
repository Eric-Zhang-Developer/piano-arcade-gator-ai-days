import type { Metadata } from "next";
import { IBM_Plex_Mono, VT323 } from "next/font/google";
import styles from "./operator.module.css";

const body = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--op-body" });
const display = VT323({ subsets: ["latin"], weight: "400", variable: "--op-display" });

export const metadata: Metadata = {
  title: "Operator mode · Piano Arcade",
  robots: { index: false, follow: false },
};

export default function OperatorLayout({ children }: LayoutProps<"/operator">) {
  return <div className={`${styles.root} ${body.variable} ${display.variable}`}>{children}</div>;
}
