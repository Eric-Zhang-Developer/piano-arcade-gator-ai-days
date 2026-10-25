import type { Metadata } from "next";
import { APP_NAME } from "@/game/app-name";

// The page is a client component, so its tab title lives here (#953).
export const metadata: Metadata = { title: `Spot the Wrong Note · ${APP_NAME}` };

export default function WrongNoteLayout({ children }: LayoutProps<"/wrong-note">) {
  return children;
}
