import { existsSync } from "node:fs";
import { join } from "node:path";
import { SLOTS, type Slot } from "./slots";

// The slots whose done note is on disk, read when the layout renders (at build for the static pages). `changes/` sits
// beside web/, where `next` runs. A production build drops the dev-only slots.
export const doneSlots = (changesDir = join(process.cwd(), "..", "changes"), production = process.env.NODE_ENV === "production"): Slot[] =>
  SLOTS.filter((s) => !(production && s.devOnly) && existsSync(join(changesDir, `${s.slug}.md`)));
