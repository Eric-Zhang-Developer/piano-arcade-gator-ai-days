import type { Metadata } from "next";
import { APP_NAME } from "../../game/app-name";

// The page is a client component, so its tab title lives here, as /simon's does (#953, #1195).
export const metadata: Metadata = { title: `Wet Paint · ${APP_NAME}` };

export default function PaintLayout({ children }: LayoutProps<"/paint">) {
  return children;
}
