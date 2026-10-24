---
name: "Spike: can webcam hand tracking tell which finger pressed a key?"
depends_on: ["piano-midi-spike"]
owns: ["spikes/finger-cam/"]
assignee: "eric"
---

# Finger cam spike

A side quest Eric asked for (2026-10-24). MIDI says which key went down but never which finger, and fingering hints
need the finger. One question: **from an overhead camera, can in-browser hand tracking name the finger that pressed
each key?** Only in `spikes/finger-cam/`, never `web/`, never on the demo's path. Time box ~2 hours of agent time; the
rest is a Gap. Fingering hints teach, the learning lane's ground (`AGENTS.md` Lanes): a build recommendation says so.

Issue: #339

## Plan
1. **Record** (`record.html`, plain JS on `localhost`, no build): one camera looks down at the keys, a phone through
   Continuity Camera or a USB webcam on a stand (the laptop's own camera faces the player). The page records it with
   `MediaRecorder` and logs each MIDI note-on from the DGX on `performance.now()`, counted from the recorder's `start`
   event. It saves `take.webm` and `notes.json`.
2. **The passage**, each hand alone at about two notes a second: the five-finger pattern C D E F G F E D C three times
   (right hand 1 2 3 4 5 4 3 2 1, left 5 4 3 2 1 2 3 4 5), then the one-octave C-major scale up and down twice, top C
   once (right 1 2 3 1 2 3 4 5 / 5 4 3 2 1 3 2 1, left 5 4 3 2 1 3 2 1 / 1 2 3 1 2 3 4 5). That's 27 + 30 = 57 notes a
   hand; `truth.json` lists each note's finger. Check every note by eye on the video, correct `truth.json` wherever
   Eric used another finger, and count the corrections.
3. **Track** (`track.html`): MediaPipe's Hand Landmarker (`@mediapipe/tasks-vision`, exact-version CDN URL, with its
   model file) on the video frame at each note-on; TensorFlow.js `hand-pose-detection` if it fails. Record each
   library's version and license.
4. **Match:** calibrate once on the first frame by marking the edges of two known white keys. White keys are evenly
   spaced and black keys sit at fixed places in the octave. At each note-on, the predicted finger is the playing hand's
   fingertip (landmark 4, 8, 12, 16 or 20) nearest the pressed key's center.
5. Write `spikes/finger-cam/FINDINGS.md` with the numbers and the recommendation.

## Requirements
- **Match rate:** notes whose predicted finger equals `truth.json`'s, out of 114, per hand and overall. A note with no
  hand found counts as a miss; report how many.
- **Where it fails:** a 5×5 finger confusion table per hand, and the scale's thumb-under and finger-over notes on their
  own line (the thumb is hidden there).
- **Sync:** video and log share a clock only as well as the recorder's start is known. Check the first 5 notes by eye
  (the key goes down at the logged time); record the offset found and apply it to every note.
- **Speed:** tracking ms per frame on this laptop, and whether that keeps up live at the camera's frame rate.
- **Setup:** camera, resolution, frame rate, its height and angle over the keys, and the lighting.

## Validation
The experiment is the validation. Each step is `action -> what you should see`.
1. **Without Eric:** `track.html` on any short clip of hands -> landmarks drawn over the frames (keep a screenshot).
   This proves the pipeline, not the piano.
2. **At the piano** (Eric): mount the camera, open `record.html`, play the passage -> `notes.json` holds 114 note-ons
   (if not, record why and line the notes up with the passage by order).
3. `track.html` over `take.webm` -> the match table prints; save it as `results.json`, with screenshots of three wrong
   notes, landmarks drawn. `verify.py --slug finger-cam-spike` -> passes, /play unchanged.
- **Build** if the overall match rate is ≥ 90%; **drop** below 70%.
- **Park** at 70–90%, naming a fix to try (another camera angle, a faster camera, the fingertip that moved down most).

## Defaults
- Plain JS, no build; libraries only from exact-version URLs, and nothing is installed into `web/`.
- The video of Eric's hands stays out of git (a `.gitignore` here; FINDINGS.md says where); logs and landmarks are
  committed. Unmeasured stays `unknown`. The done note (`changes/finger-cam-spike.md`, 3–8 lines) gives the
  recommendation, the numbers that decided it, and FINDINGS.md.
