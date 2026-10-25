// Jam mode spike (specs/features/jam-mode-spike/spec.md): name the chord a player holds, and have the DGX's drums and
// bass (piano-midi's R5 groove) follow it from the next beat. No dependency: imported by index.html and by Node.
// Self-test: node spikes/jam-mode/jam.mjs --self-test

export const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
// The qualities, simplest first: a tie in score and root goes to the earlier one.
export const QUALITIES = [
  ["major", [0, 4, 7], ""],
  ["minor", [0, 3, 7], "m"],
  ["7", [0, 4, 7, 10], "7"],
  ["maj7", [0, 4, 7, 11], "maj7"],
  ["m7", [0, 3, 7, 10], "m7"],
  ["dim", [0, 3, 6], "dim"],
  ["aug", [0, 4, 8], "+"],
  ["sus2", [0, 2, 7], "sus2"],
  ["sus4", [0, 5, 7], "sus4"],
  ["power", [0, 7], "5"],
];

/**
 * The chord in `held` (MIDI pitches), or null for one pitch class or none. Each root × quality scores
 * |held ∩ template| − |template − held| − |held − template| on pitch classes; the highest wins, then the one whose
 * root is the lowest held note, then the simpler quality. A best score of 0 or less is no chord.
 */
export function nameChord(held) {
  const pcs = new Set([...held].map((p) => ((p % 12) + 12) % 12));
  if (pcs.size < 2) return null;
  const low = Math.min(...held) % 12;
  let best = null;
  for (let root = 0; root < 12; root++)
    QUALITIES.forEach(([quality, steps, suffix], q) => {
      const t = new Set(steps.map((s) => (root + s) % 12));
      let hit = 0;
      for (const p of t) if (pcs.has(p)) hit++;
      const score = hit - (t.size - hit) - (pcs.size - hit);
      const rank = [score, root === low ? 1 : 0, -q];
      if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && (rank[1] > best.rank[1] || (rank[1] === best.rank[1] && rank[2] > best.rank[2]))))
        best = { rank, root, quality, name: NAMES[root] + suffix };
    });
  if (best.rank[0] <= 0) return null;
  return { root: best.root, quality: best.quality, bass: low, name: best.name };
}

/** What the player holds, from channel 1 MIDI: keys down, plus released keys while the sustain pedal (CC 64 ≥ 64) is down. */
export function createHeld() {
  const down = new Set();
  const sustained = new Set();
  let pedal = false;
  return {
    // Returns true when the held set changed. Other channels are ignored: the DGX copies CC 64 to channel 2, and in the
    // loopback run the band's own notes come back on 2 and 10.
    message([s, a, b]) {
      if ((s & 0x0f) !== 0) return false;
      const type = s & 0xf0;
      if (type === 0x90 && b > 0) {
        down.add(a);
        sustained.delete(a);
        return true;
      }
      if (type === 0x80 || type === 0x90) {
        if (!down.delete(a)) return false;
        if (pedal) sustained.add(a);
        return true;
      }
      if (type === 0xb0 && a === 64) {
        const now = b >= 64;
        if (now === pedal) return false;
        pedal = now;
        if (!pedal && sustained.size) {
          sustained.clear();
          return true;
        }
      }
      return false;
    },
    pitches: () => [...down, ...sustained],
  };
}

// The bass's MIDI note for a root: that pitch class in the octave nearest MIDI 40 (E2), the lower one on a tie.
export const bassNote = (root) => {
  const up = 40 + ((root - 40) % 12 + 12) % 12;
  return up - 40 <= 6 ? (up - 40 === 6 ? up - 12 : up) : up - 12;
};

/**
 * R5's groove, following a chord: hi-hat every 8th, kick on 1 and 3, snare on 2 and 4 (channel 10), and the root in
 * 8ths on channel 2 (GM Electric Bass, finger). Call tick() often; each 8th is sent once it's within lookaheadMs, with
 * its time as the send timestamp. A chord set with setChord() takes over at the first beat sent after it; the off-beat
 * 8th keeps its beat's root. Before any chord the bass rests. Never sends on channel 1.
 */
export function createBand({ bpm = 100, beatsPerBar = 4, lookaheadMs = 50, send, now }) {
  const eighth = 30_000 / bpm;
  let next = null; // the next 8th's time
  let e = 0; // its index in the bar
  let chord = null; // the latest named chord
  let playing = null; // the root of the beat being played
  const note = (at, dur, n, ch, vel) => {
    send([0x90 | ch, n, vel], at);
    send([0x80 | ch, n, 0], at + dur);
  };
  return {
    eighthMs: eighth,
    start(at = now() + 100) {
      send([0xc1, 33]); // channel 2: GM program 34, Electric Bass (finger)
      next = at;
      e = 0;
    },
    setChord(c) {
      if (c) chord = c;
    },
    // Each 8th sent, for the log: { at, eighth, root }.
    tick(onSent) {
      if (next === null) return;
      while (next < now() + lookaheadMs) {
        if (e % 2 === 0) playing = chord ? chord.root : null;
        note(next, 60, 42, 9, 70);
        if (e === 0 || e === beatsPerBar) note(next, 60, 36, 9, 100);
        if (e === 2 || e === 6) note(next, 60, 38, 9, 100);
        if (playing !== null) note(next, Math.round(eighth * 0.8), bassNote(playing), 1, 100);
        onSent?.({ at: next, eighth: e, root: playing });
        next += eighth;
        e = (e + 1) % (beatsPerBar * 2);
      }
    },
    // All Notes Off (CC 123) on channels 2 and 10, now and again 300 ms later, after anything already queued.
    stop() {
      next = null;
      const t = now();
      for (const at of [t, t + 300]) for (const ch of [1, 9]) send([0xb0 | ch, 123, 0], at);
    },
  };
}

// ---- self-test: no MIDI, a fake clock and output ----
function selfTest() {
  let failed = 0;
  let passed = 0;
  const check = (ok, what) => (ok ? passed++ : (failed++, console.error(`FAIL ${what}`)));
  const named = (pitches) => nameChord(pitches);

  // 1. Every root × quality in root position, from MIDI 48 up.
  for (let root = 0; root < 12; root++)
    for (const [quality, steps] of QUALITIES) {
      const c = named(steps.map((s) => 48 + root + s));
      check(c && c.root === root && c.quality === quality, `root position ${NAMES[root]} ${quality}: got ${c?.name}`);
    }
  // 2. Every inversion of major, minor, 7, maj7, m7 and dim: the lowest notes move up an octave in turn.
  for (let root = 0; root < 12; root++)
    for (const [quality, steps] of QUALITIES.filter(([q]) => ["major", "minor", "7", "maj7", "m7", "dim"].includes(q)))
      for (let inv = 1; inv < steps.length; inv++) {
        const pitches = steps.map((s, i) => 48 + root + s + (i < inv ? 12 : 0));
        const c = named(pitches);
        check(c && c.root === root && c.quality === quality, `${NAMES[root]} ${quality} inversion ${inv}: got ${c?.name}`);
      }
  // 3. The ambiguous sets, pinned by the tie rule (counted apart in FINDINGS.md).
  const pinned = [
    [[52, 56, 60], "E+", "C+ first inversion = E+: the lowest note's root"],
    [[56, 60, 64], "A♭+", "C+ second inversion = A♭+"],
    [[55, 60, 62], "Gsus4", "Csus2 with G lowest = Gsus4"],
    [[62, 67, 72], "Csus2", "C D G with D lowest: no root is lowest, so the simpler sus2"],
    [[48, 52, 55, 57], "Am7", "C6 = Am7: there's no 6 template"],
    [[57, 60, 64, 67], "Am7", "Am7 root position"],
    [[48, 52], "C", "C E: C major beats A minor on the lowest note"],
    [[48, 51, 54, 57], "Cdim", "a dim7 (no template) names its lowest note's dim triad"],
  ];
  for (const [p, name, why] of pinned) check(named(p)?.name === name, `${why}: got ${named(p)?.name}`);
  check(named([60]) === null && named([]) === null && named([48, 60]) === null, "one pitch class or none: null");

  // 4. Pedal-held notes count; releasing the pedal drops them.
  const h = createHeld();
  for (const n of [60, 64, 67]) h.message([0x90, n, 80]);
  h.message([0xb0, 64, 100]);
  h.message([0xb1, 64, 0]); // the DGX's channel 2 copy: ignored
  for (const n of [60, 64, 67]) h.message([0x90, n, 0]);
  check(named(h.pitches())?.name === "C", `pedal holds C major after the keys go up: got ${named(h.pitches())?.name}`);
  h.message([0xb0, 64, 10]);
  check(h.pitches().length === 0, "pedal up drops the sustained notes");
  h.message([0x91, 43, 90]); // channel 2: the band's bass coming back in the loopback
  check(h.pitches().length === 0, "other channels don't count as held");

  // 5. A scripted progression on a fake clock: each beat's bass notes carry its root, once the change came at least
  // the lookahead before that beat.
  let t = 0;
  const sent = [];
  const band = createBand({ bpm: 100, lookaheadMs: 50, send: (d, at) => sent.push([d, at]), now: () => t });
  const beat = 600;
  band.start(0);
  // Changes 100 ms before beats 4, 8, 12 (C, Am, F, G), and one only 20 ms before beat 16 (Dm7).
  const changes = [[-100, [60, 64, 67]], [2300, [57, 60, 64]], [4700, [53, 57, 60]], [7100, [55, 59, 62]], [9580, [50, 53, 57, 60]]];
  const expect = []; // [first beat that must follow, root]
  for (; t < 12_000; t += 5) {
    for (const [at, pitches] of changes) if (t === Math.max(0, at)) band.setChord(nameChord(pitches));
    band.tick();
  }
  for (const [at, pitches] of changes) expect.push([Math.ceil((Math.max(0, at) + 50) / beat), nameChord(pitches).root]);
  const bass = sent.filter(([d]) => d[0] === 0x91 && d[2] > 0);
  let wrong = 0;
  for (const [d, at] of bass) {
    const b = Math.floor(at / beat + 1e-9);
    const root = expect.filter(([from]) => from <= b).at(-1)?.[1];
    if (root !== undefined && d[1] % 12 !== root) wrong++;
  }
  check(bass.length > 30 && wrong === 0, `scripted progression: ${bass.length} bass notes, ${wrong} on the wrong root`);
  // A change 20 ms before beat 16 comes after that beat was sent (50 ms ahead): beat 16 keeps G, beat 17 plays D.
  const on = (b) => bass.find(([, at]) => at >= b * beat && at < (b + 1) * beat)?.[0][1] % 12;
  check(on(16) === 7 && on(17) === 2, `a change inside the lookahead follows one beat later: beat 16 ${on(16)}, beat 17 ${on(17)}`);
  check(bass.every(([d]) => d[1] >= 34 && d[1] <= 46), "bass notes in the octave nearest MIDI 40");

  // 6. stop(): CC 123 on channels 2 and 10, twice, 300 ms apart; nothing ever on channel 1.
  sent.length = 0;
  band.stop();
  const offs = sent.filter(([d]) => (d[0] & 0xf0) === 0xb0 && d[1] === 123);
  check(offs.length === 4 && new Set(offs.map(([d]) => d[0])).size === 2 && offs.some(([, at]) => at === t + 300), "stop: CC 123 on 2 and 10, twice");
  band.tick();
  check(sent.length === 4, "nothing sent after stop");
  check(bass.length && !sent.some(([d]) => (d[0] & 0x0f) === 0), "nothing on channel 1");

  process.stdout.write(`jam self-test: ${passed} passed, ${failed} failed\n`);
  return failed;
}

if (typeof process !== "undefined" && process.argv?.includes("--self-test")) process.exit(selfTest() ? 1 : 0);
