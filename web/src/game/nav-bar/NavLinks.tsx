"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonoLabel } from "../duo-tokens";
import { hideNav, isCurrent, type Slot } from "./slots";
import styles from "./nav-bar.module.css";

// Thin, centered in the top edge's empty band (decision nav-bar-layout), off the take and kiosk pages. Capture mode
// hides it through data-capture-hide, so the stored flag counts too.
export function NavLinks({ slots }: { slots: Slot[] }) {
  const pathname = usePathname();
  if (hideNav(pathname, false)) return null;
  return (
    <nav className={styles.bar} aria-label="Pages" data-capture-hide data-testid="nav-bar">
      {slots.map((s) => {
        const current = isCurrent(s, pathname);
        return (
          <Link
            key={s.path}
            href={s.path}
            className={styles.slot}
            aria-current={current ? "page" : undefined}
            data-testid={`nav-${s.slug}`}
          >
            <MonoLabel dim={!current} style={current ? { fontSize: "inherit", color: "var(--pa-primary)" } : { fontSize: "inherit" }}>
              {s.label}
            </MonoLabel>
          </Link>
        );
      })}
    </nav>
  );
}
