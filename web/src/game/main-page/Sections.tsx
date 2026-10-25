"use client";
// The select's sections on screen (spec: main-page): the chip strip over the list, which jumps to a section, and each
// section's header. select-layout places them; sectionsOf decides what they are.
import { useMemo, useRef } from "react";
import { kitChip, MonoLabel } from "../duo-tokens";
import { headerFrames, useMoveAnimation } from "../select-motion";
import type { Section } from ".";
import css from "./main-page.module.css";

// A section's header id, from its key: a composer's surname may carry accents or spaces, an id may not.
export const sectionId = (key: string) => `section-${key.normalize("NFD").replace(/[^a-z0-9-]+/gi, "")}`;

// What a viewer reads here: 16 px at 720, 24 px at 1080 (visual-direction.md), in vh like the rows under it.
const READ = "clamp(16px, 2.25vh, 24px)";

// One chip per section of the current sort, the focused song's section lit, then where that song is in the list.
// A click is the whole control (mouse-first): no key hint here.
export function SectionChips({
  sections,
  current,
  place,
  count,
  onJump,
}: {
  sections: Section[];
  current?: string; // the focused song's section
  place: number; // the focused song's place in the shown list, from 1; 0 when nothing is shown
  count: number;
  onJump: (key: string) => void;
}) {
  return (
    <div className={css.strip}>
      <nav className={css.chips} aria-label="Jump to a section">
        {sections.map((s) => {
          const chip = kitChip(s.key === current);
          return (
            <button
              key={s.key}
              type="button"
              className={chip.className}
              style={{ ...chip.style, fontSize: READ, padding: "0.2em 0.55em", letterSpacing: "0.06em" }}
              aria-current={s.key === current || undefined}
              aria-controls={sectionId(s.key)}
              data-testid={`chip-${s.key}`}
              onClick={() => onJump(s.key)}
            >
              {s.label}
            </button>
          );
        })}
      </nav>
      {count > 0 && (
        <MonoLabel style={{ fontSize: READ }}>
          {/* A span can't take a name, so the place is read from text (#1237). */}
          <span className={css.place} data-testid="list-place" aria-hidden="true">
            <b>{place}</b> / {count}
          </span>
          <span className={css.srOnly}>{`Song ${place} of ${count}`}</span>
        </MonoLabel>
      )}
    </div>
  );
}

// A chip that lands on this section settles its header in (select-motion).
export function SectionHeader({ section }: { section: Section }) {
  const n = section.songs.length;
  const ref = useRef<HTMLHeadingElement>(null);
  useMoveAnimation(ref, useMemo(() => headerFrames(section.key), [section.key]));
  return (
    <h3 ref={ref} className={css.header} id={sectionId(section.key)} data-testid={`section-${section.key}`}>
      <span>{section.label}</span>
      <MonoLabel style={{ fontSize: READ }}>{n === 1 ? "1 song" : `${n} songs`}</MonoLabel>
    </h3>
  );
}
