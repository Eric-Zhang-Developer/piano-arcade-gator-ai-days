import type { Metadata } from "next";
import styles from "./operator.module.css";
import { APP_NAME } from "@/game/app-name";

export const metadata: Metadata = {
  title: `Operator mode · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

// The Duo look (foreman-duo): the root layout's Saira and data mono, so this page loads no fonts of its own.
export default function OperatorLayout({ children }: LayoutProps<"/operator">) {
  return <div className={styles.root}>{children}</div>;
}
