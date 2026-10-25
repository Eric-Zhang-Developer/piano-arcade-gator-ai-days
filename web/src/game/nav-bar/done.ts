import { existsSync } from "node:fs";
import { join } from "node:path";
import { SLOTS, type Slot } from "./slots";

// The slots whose done note is on disk, read when the layout renders (at build for the static pages). `changes/` sits
// beside web/, where `next` runs.
export const doneSlots = (changesDir = join(process.cwd(), "..", "changes")): Slot[] =>
  SLOTS.filter((s) => existsSync(join(changesDir, `${s.slug}.md`)));
