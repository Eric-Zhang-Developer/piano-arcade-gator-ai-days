"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GITHUB_URL, hideNav, isCurrent, type Slot } from "./slots";
import styles from "./nav-bar.module.css";

// Thin, centered in the top edge's band (decision nav-bar-layout), off the take and kiosk pages. The repo is off-site,
// so it's a small mark in the bottom-right corner, not a page in the row. Capture mode hides both through
// data-capture-hide, so the stored flag counts too.
export function NavLinks({ slots }: { slots: Slot[] }) {
  const pathname = usePathname();
  if (hideNav(pathname, false)) return null;
  return (
    <>
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
              <span className={styles.label}>{s.label}</span>
            </Link>
          );
        })}
      </nav>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.repo}
        aria-label="GitHub repository"
        title="GitHub repository"
        data-capture-hide
        data-testid="nav-github"
      >
        {/* The GitHub mark, inline: nothing to load. */}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
    </>
  );
}
