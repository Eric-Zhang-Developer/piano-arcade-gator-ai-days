"use client";
// Phone guard (spec: phone-guard): on a phone or tablet, / and /play show a card saying the game is made for a laptop
// keyboard or a real piano, instead of a highway that can't be played. CSS alone decides when (styles.guard), so it's
// in the server HTML and a laptop never flashes it. "Play anyway" hides it for this tab.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./phone-guard.module.css";

export const phoneGuardSettings = {
  repoUrl: "https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days",
  videoUrl: "", // unknown yet: no link until Eric gives it
  routes: ["/", "/play"],
};

export const PHONE_OK_KEY = "pianoArcade.phoneOk";
// Keep in step with the @media rule in phone-guard.module.css.
export const PHONE_QUERY = "(hover: none) and (pointer: coarse), (max-width: 480px)";

export function PhoneGuard() {
  const path = usePathname();
  const card = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  // data-ok hides the card (CSS), set from here so the server HTML and the first client render stay the same.
  const hide = () => card.current?.setAttribute("data-ok", "");

  useEffect(() => {
    let stored = false;
    try {
      stored = sessionStorage.getItem(PHONE_OK_KEY) === "1";
    } catch {
      // blocked storage: the card shows until Play anyway
    }
    if (stored) card.current?.setAttribute("data-ok", "");
    else if (window.matchMedia(PHONE_QUERY).matches) first.current?.focus();
    // A modal keeps focus while it shows: /play focuses its own controls once the chart loads, behind the card.
    const keep = (e: FocusEvent) => {
      const c = card.current;
      if (c && !c.hasAttribute("data-ok") && window.matchMedia(PHONE_QUERY).matches && !c.contains(e.target as Node)) first.current?.focus();
    };
    document.addEventListener("focusin", keep);
    return () => document.removeEventListener("focusin", keep);
  }, [path]);

  if (!phoneGuardSettings.routes.includes(path)) return null;
  const playAnyway = () => {
    try {
      sessionStorage.setItem(PHONE_OK_KEY, "1");
    } catch {
      // blocked storage: hidden for this page only
    }
    hide();
  };
  return (
    <div ref={card} className={styles.guard} role="dialog" aria-modal="true" aria-labelledby="phone-guard-title" data-testid="phone-guard">
      <div className={styles.card}>
        <h1 id="phone-guard-title" className={styles.wordmark}>
          Piano Arcade
        </h1>
        <p className={styles.lead}>Piano Arcade is made for a laptop keyboard or a real piano.</p>
        <p className={styles.hint}>Open it in Chrome on a laptop.</p>
        <div className={styles.links}>
          <a ref={first} href={phoneGuardSettings.repoUrl} className={styles.link}>
            See the code
          </a>
          {phoneGuardSettings.videoUrl && (
            <a href={phoneGuardSettings.videoUrl} className={styles.link}>
              Watch the video
            </a>
          )}
        </div>
        <button type="button" className={styles.anyway} onClick={playAnyway}>
          Play anyway
        </button>
      </div>
    </div>
  );
}
