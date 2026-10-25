import type { Metadata } from "next";
import styles from "../operator/operator.module.css";
import { APP_NAME } from "@/game/app-name";

export const metadata: Metadata = {
  title: `Attract mode · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

// operator-board's Duo look, borrowed (read-only) so the two pages are one cabinet; the fonts are the root layout's.
export default function AttractLayout({ children }: LayoutProps<"/attract">) {
  return <div className={styles.root}>{children}</div>;
}
