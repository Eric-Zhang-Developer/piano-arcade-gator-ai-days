"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const topLevel = () => window.top === window.self;
const serverSnapshot = () => false;

// Other workspaces already have in-flow links to /. Never rely on history:
// a deep-linked game or simulator must have a way back to song selection.
export function Home() {
  const pathname = usePathname();
  const visible = useSyncExternalStore(subscribe, topLevel, serverSnapshot);
  if (!visible || !["/play", "/sim", "/attract", "/cabinet", "/operator"].includes(pathname)) return null;
  return <Link href="/" aria-label="Home — song selection" style={{ position: "fixed", top: 12, left: 12, zIndex: 3000, padding: "8px 14px", border: "1px solid #5ef2c4", borderRadius: 6, color: "#f2f2f5", background: "#141022", textDecoration: "none", font: "600 14px system-ui" }}>Home</Link>;
}
