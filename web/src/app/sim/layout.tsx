import type { Metadata } from "next";
import { APP_NAME } from "@/game/app-name";

// The page is a client component, so its tab title lives here (#953).
export const metadata: Metadata = { title: `Piano sim · ${APP_NAME}` };

export default function SimLayout({ children }: LayoutProps<"/sim">) {
  return children;
}
