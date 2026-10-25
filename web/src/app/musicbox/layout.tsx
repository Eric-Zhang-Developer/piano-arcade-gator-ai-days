import type { Metadata } from "next";
// Relative, not "@/", so polish.test.tsx can import the metadata: vitest has no "@/" alias.
import { APP_NAME } from "../../game/app-name";

// The page is a client component, so its tab title lives here (#1198).
export const metadata: Metadata = { title: `Pinned · ${APP_NAME}` };

export default function MusicboxLayout({ children }: LayoutProps<"/musicbox">) {
  return children;
}
