// Following a take on a rendered score: the cursor to the chart clock, and judged noteheads painted in place.
// Built again after every OSMD render (a zoom re-renders, and the old graphical notes go with the old SVG).
import type { GraphicalNote, OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Chart, Judgment } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { beamJudgment, shouldBeam } from "../sheet-beams";
import { DIVISIONS, keyAndMeter, placeNotes } from "../sheet-xml";

const MIDI_FROM_HALFTONE = 12; // OSMD's halfTone puts C4 at 48; MIDI puts it at 60
const key = (staff: number, onset: number, pitch: number) => `${staff}:${onset}:${pitch}`;

// The VexFlow side of a graphical note: its StaveNote, and that note's beam once OSMD has drawn one. A chord is one
// StaveNote, so its notes share it.
interface VfBeam {
  notes: { attrs: { id: string } }[];
}
const vf = (gn: GraphicalNote | undefined) => (gn as unknown as { vfnote?: [{ beam?: VfBeam | null }] } | undefined)?.vfnote?.[0];

export interface Follower {
  clock(nowMs: number): HTMLElement | null; // the cursor element when it moved, for the page to scroll to
  paint(noteId: string, color: string): boolean; // false: no notehead found for that note
  // The beam over this note, colored by sheet-beams' rule from the take's judgments; ink until they all agree.
  paintBeam(noteId: string, judged: ReadonlyMap<string, Judgment>, colors: Record<Judgment, string>, ink: string): void;
  beams: { should: number; beamed: number }; // of the notes a score would beam, how many OSMD drew under a beam
}

export function follow(osmd: OpenSheetMusicDisplay, chart: Chart): Follower {
  // Every notehead by (staff, onset in 16ths, MIDI pitch). A tied note's later pieces start later, so the key finds
  // its first notehead; the first written wins.
  const heads = new Map<string, GraphicalNote>();
  osmd.GraphicSheet.MeasureList.forEach((row) =>
    row.forEach((measure, staffIndex) => {
      for (const entry of measure?.staffEntries ?? [])
        for (const voice of entry.graphicalVoiceEntries)
          for (const gn of voice.notes) {
            const n = gn.sourceNote;
            if (n.isRest()) continue;
            const onset = Math.round(n.getAbsoluteTimestamp().RealValue * 4 * DIVISIONS);
            const k = key(staffIndex + 1, onset, n.halfTone + MIDI_FROM_HALFTONE);
            if (!heads.has(k)) heads.set(k, gn);
          }
    }),
  );
  const placed = placeNotes(chart);
  const byId = new Map(placed.map((p) => [p.id, heads.get(key(p.staff, p.onset, p.pitch))]));

  // Each drawn beam's note ids, through the StaveNotes under it.
  const idsOf = new Map<object, string[]>();
  for (const [id, gn] of byId) {
    const note = vf(gn);
    if (note) idsOf.set(note, [...(idsOf.get(note) ?? []), id]);
  }
  const beamOf = (id: string) => vf(byId.get(id))?.beam ?? null;
  const should = shouldBeam(placed, keyAndMeter(chart).meter).flat();
  const beams = { should: should.length, beamed: should.filter((id) => beamOf(id)).length };

  // Each cursor stop's time in quarter-note beats, walked once on a clone so the visible cursor stays put.
  const stops: number[] = [];
  const cursor = osmd.cursor;
  cursor.show();
  cursor.reset();
  for (const it = cursor.iterator.clone(); !it.EndReached; it.moveToNext()) stops.push(it.currentTimeStamp.RealValue * 4);
  let at = 0;
  const mpb = msPerBeat(chart.bpm);

  return {
    clock(nowMs) {
      const beat = nowMs / mpb;
      let target = 0; // the last stop at or before now; the first one during the count-in
      for (let lo = 0, hi = stops.length - 1; lo <= hi; ) {
        const mid = (lo + hi) >> 1;
        if (stops[mid] <= beat + 1e-6) {
          target = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (target === at) return null;
      if (target < at) {
        cursor.reset(); // Retry, or a loop back to its start
        at = 0;
      }
      for (; at < target; at++) cursor.next();
      return cursor.cursorElement;
    },
    paint(noteId, color) {
      const gn = byId.get(noteId);
      gn?.setColor(color, { applyToNoteheads: true });
      return !!gn;
    },
    paintBeam(noteId, judged, colors, ink) {
      const beam = beamOf(noteId);
      if (!beam) return;
      const j = beamJudgment(beam.notes.flatMap((n) => idsOf.get(n) ?? [undefined]).map((id) => (id ? judged.get(id) : undefined)));
      const color = j ? colors[j] : ink;
      // VexFlow draws each of a beam's lines (one per 8th, 16th…) in a group named for its first note,
      // "vf-<first StaveNote's id>-beam<n>". OSMD rebuilds its Beam objects after drawing, so not the beam's own id.
      for (const g of document.querySelectorAll<SVGGElement>(`[id^="vf-${CSS.escape(beam.notes[0].attrs.id)}-beam"]`))
        for (const el of [g, ...g.querySelectorAll<SVGElement>("*")]) {
          el.setAttribute("fill", color);
          el.setAttribute("stroke", color);
        }
    },
    beams,
  };
}
