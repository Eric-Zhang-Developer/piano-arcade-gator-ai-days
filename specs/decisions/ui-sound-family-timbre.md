# UI sound family: timbre, figures, level and pile-up

Feature: `ui-sound-family` (#1167). Every value below is in `timbreSettings`, `pileSettings`, `LENGTH_S`
(`web/src/game/ui-sounds/timbre.ts`) or `uiSoundSettings` (`ui-sounds/index.ts`), so each one undoes in one line.
They are design choices, picked by measurement, not by ear. Eric's 1-minute A/B listen
(`/play?song=twinkle&x=ui-sounds-ab`) is the check that's still missing.

## The celesta
- **Partials:** ratio and amplitude are 1 : 1, 2.01 : 0.3, 3.03 : 0.1 and 4.07 : 0.035. They're slightly stretched,
  as a struck bar's are, and fall off fast, so the centroid lands at 870–1030 Hz.
- **Decay:** the fundamental's time constant is 45 ms. Each partial decays faster, by its ratio^0.7. The sting's last
  note rings at 130 ms.
- **Attack:** a 5 ms raised cosine, measured at 3.8–5.2 ms from 10% to 90%.
- **Hammer:** 1.5 ms of seeded noise at 0.12, shaped inside the attack, so the strike has an edge without a click.
- **Tail:** a 12 ms raised-cosine fade. The last sample is exactly 0.
- **Range:** the tonic sits between F♯4 and F5, so every key stays in the same low-mid band.

## The woodblock (tick, accent)
- **Partials:** 1 : 1 and 2.47 : 0.22, with a 12 ms decay, at beat-track's 1320 and 1760 Hz.
- **Length:** 60 ms.

## The figures
- **move:** the next scale degree, up an octave and round. The walk restarts on the tonic after 1 s without a
  move.
- **confirm:** the tonic and fifth struck together, the fifth at 0.8.
- **back:** the fifth, then the tonic 50 ms later.
- **sting:** up the triad (degrees 1, 3, 5) at 0, 90 and 180 ms, with the 5th ringing. It lasts 550 ms, against the
  old one's 760.

## The level: 18 dB under the preview, not 12
- **Measured:** at 15 dB under on peak, `back` was only 10.9 dB under on RMS (`measurements.md` has the method).
- **Why RMS binds:** a 150 ms strike's RMS sits close to its peak. The preview's RMS sits 14 dB under its own peak,
  because of its gaps and decays.
- **Result at 18:** every sound is 13.9 dB or more under on both.
- **Undo:** `underPreviewDb`.

## Pile-up
- **The 60 ms gap:** a sound within 60 ms of the last steals the oldest voice, fading it over 5 ms.
- **The cap:** 4 voices.
- **Velocity:** repeats closer than 150 ms ease it by ×0.88, down to a floor of 0.55. A 400 ms pause brings it back
  to full.
- **Measured** (`ab.test.ts`): 40 moves in 2 s never pass the cap, and the summed peak stays under the 12 dB
  ceiling.
