import type { Metadata } from "next";
import { APP_NAME } from "../../game/app-name";

// The page is a client component, so its tab title lives here (#1128).
export const metadata: Metadata = { title: `Real Keys · ${APP_NAME}` };

export default function RealKeysLayout({ children }: LayoutProps<"/real-keys">) {
  return children;
}
