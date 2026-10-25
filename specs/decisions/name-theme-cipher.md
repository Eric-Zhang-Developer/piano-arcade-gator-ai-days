# name-theme: the letter tables, and where they came from

**Context.** The spec asks for the 1909 French system from a cited source, and the German letter names only if
sourced. Nothing here was written from memory; a research pass read the sources below, and I re-read the saved copies
(the WMU script's letter table, French Wikipedia's wikitext, the Proksch PDF's text) before writing the tables.

## French, 1909 (shipped, the default)
- **Table:** A–G as themselves. Under do ré mi fa sol la si: C J Q X · D K R Y · E L S Z · F M T · G N U · A I O V ·
  B♭(B) H P W. So H is si (B♮) and I is la.
- **Sources:**
  - Jacques Chailley, "Anagrammes musicales et « langages communicables »", *Revue de musicologie* 67/1 (1981),
    p. 72, as reproduced in French Wikipedia's "Hommage à Haydn" (https://fr.wikipedia.org/wiki/Hommage_%C3%A0_Haydn).
    The commission was Jules Écorcheville's, for the *Revue musicale S.I.M.* (issue of 15 January 1910).
  - Western Michigan University's Écorcheville cipher, which cites the 1909 *Hommage à Joseph Haydn*
    (wmich.edu/mus-theo/ciphers/ecorcheville.html; the live site refused the connection, so I read its archived
    script). Same rows, every letter.
- **The anchor:** HAYDN is B–A–D–D–G. Bryan Proksch, "Recomposing H-A-Y-D-N", *Eisenstädter Haydn-Berichte* 8
  (2013), p. 369, says it was rendered that way, with H as its traditional B natural. Chailley, as French Wikipedia
  gives it, writes si la ré ré sol.
- **Where the sources differ:**
  - **B.** Chailley prints B♭ (si bémol); WMU writes plain B. **Choice: B♭, after Chailley,** since he is the
    musicologist and the table is his. P and W stay B♮ under si. Undo: set `B: B` in `FRENCH` (`cipher.ts`).
  - **H and I.** English Wikipedia's "Musical cryptogram" lays out a plain run (H under la) and then says Écorcheville
    moved H to B♮, without saying where I goes. Chailley and WMU both put I under la, which is what ships.
  - **Not read:** the 1910 *Revue S.I.M.* itself (Gallica blocked the request), Sams's Grove article directly, and
    Soucy's 2009 thesis. The primary source would settle B.
- **Left out:** Saint-Saëns's objection to the scheme, and Duruflé's different French layout. Neither is used.

## German letter names (shipped, on the switch)
- **Table:** A, B = B♭, C, D, E, F, G, H = B♮, S = E♭ (Es). Every other letter is skipped. Composers using it
  "usually seem to have chosen to ignore non-musical letters", as English Wikipedia's article puts it.
- **Sources:** Eric Sams, "Cryptography, musical", *The New Grove* (1980), vol. 5, p. 80, as English Wikipedia's
  "Musical cryptogram" cites it. That article gives B♭ = B, B♮ = H, Es = S, As = A♭, and Brahms's B-A-H-S. BACH as
  B♭–A–C–B♮ is also on the Bach Cantatas Website (bach-cantatas.com/Arran/L-BACH.htm). ABEGG as A–B♭–E–G–G is per
  Blom, *Some Great Composers* (1961), p. 85, cited by Wikipedia, and interlude.hk's Abegg Variations article.
- **Single-source:** S = E♭ has only the Wikipedia/Grove line; no second source was found.
- **Left out:** "As" (A♭). It would make an A followed by an S read two ways.

## Input
- Accents fold to their base letter (NFD, combining marks dropped).
- Letters without a decomposition (ı, đ, ø, ł) aren't A–Z after folding, so they're skipped.
- Anything else is ignored. The motif stops at 12 letters (`composeSettings.maxLetters`), the most that still fits
  20 s at 96 bpm.
