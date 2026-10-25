// The letter tables (spec: name-theme). Each one is copied from the sources named beside it; how they were checked,
// and where they disagree, is in specs/decisions/name-theme-cipher.md. Pitch classes: 0 = C, 10 = B♭, 11 = B♮.
import type { Cipher } from "./compose";

export type CipherId = "french" | "german";

const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, Bb = 10, B = 11, Eb = 3;

/**
 * The 1909 French table, for the Revue musicale S.I.M.'s Haydn centenary pieces (Debussy, Ravel, Dukas, d'Indy,
 * Hahn, Widor): A–G as themselves, the rest of the alphabet in rows under do ré mi fa sol la si, with H under si
 * and I under la. Copied from Jacques Chailley's table, "Anagrammes musicales et « langages communicables »",
 * Revue de musicologie 67/1 (1981), p. 72, as French Wikipedia's "Hommage à Haydn" reproduces it; the same rows as
 * Western Michigan University's Écorcheville cipher (wmich.edu/mus-theo/ciphers/ecorcheville.html), except B,
 * which Chailley gives as B♭ (si bémol) and WMU as B. We follow Chailley.
 */
export const FRENCH: Cipher = {
  A, B: Bb, C, D, E, F, G,
  H: B, I: A, J: C, K: D, L: E, M: F, N: G,
  O: A, P: B, Q: C, R: D, S: E, T: F, U: G,
  V: A, W: B, X: C, Y: D, Z: E,
};

/**
 * The German letter names: B is B♭ and H is B♮, and S stands for E♭ (Es), as in Brahms's B-A-H-S. Eric Sams,
 * "Cryptography, musical", The New Grove (1980), vol. 5, p. 80, as English Wikipedia's "Musical cryptogram" cites
 * it. Other letters spell nothing and are skipped, as composers using it did. "As" (A♭) is left out: it would read
 * an A followed by an S two ways.
 */
export const GERMAN: Cipher = { A, B: Bb, C, D, E, F, G, H: B, S: Eb };

export const CIPHERS: Record<CipherId, { cipher: Cipher; label: string; line: string }> = {
  french: { cipher: FRENCH, label: "French, 1909", line: "Every letter sounds: past G the alphabet wraps under do ré mi, as for Haydn's centenary." },
  german: { cipher: GERMAN, label: "German", line: "Only the letters that are note names sound: B is B♭, H is B♮, S is E♭, as in B-A-C-H." },
};

// The letters a cipher spells, in order: what the motif is made of.
export const spelled = (letters: string, cipher: Cipher): string => [...letters].filter((l) => l in cipher).join("");
