"use client";
// Leaving /name and /play clears the held name (spec: name-theme, Privacy): one effect on the pathname, mounted once
// in the root layout. A reload clears it anyway: it was only ever in memory.
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { clear, keepsName } from "./memory";

export function NameThemeGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (!keepsName(pathname)) clear();
  }, [pathname]);
  return null;
}
