// The band player page's controls. The MIDI reading and window scheduling are the game's: backing-track/band.mjs.
import { between, GM_ON, readMidi, setup, silence } from "../../web/src/game/backing-track/band.mjs";

const q = new URLSearchParams(location.search);
const PORT = q.get("port") || "Portable Grand";
// Channel 1 is the player's, as in the game; ?mute= replaces that list (?mute= alone plays every channel).
const MUTE = new Set((q.has("mute") ? q.get("mute") : "1").split(",").filter(Boolean).map(Number));
const ALL = Array.from({ length: 16 }, (_, i) => i + 1);
const LOOKAHEAD_MS = 400;
const $ = (id) => document.getElementById(id);
let output = null, band = null, name = "", play = null, countIn = true;

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, "0")}`;

function load(bytes, label) {
  $("parts").replaceChildren();
  try {
    const file = readMidi(bytes);
    band = { ...file, events: file.events.filter((e) => !MUTE.has((e.data[0] & 0x0f) + 1)) };
  } catch (e) {
    band = null;
    $("file").textContent = `${label}: ${e.message}`;
  }
  $("play").disabled = !band?.events.length;
  if (!band) return;
  name = label;
  $("file").textContent = `${label}: ${clock(band.endMs)}`;
  for (const ch of band.channels) {
    const evs = band.events.filter((e) => (e.data[0] & 0x0f) + 1 === ch);
    const program = evs.find((e) => (e.data[0] & 0xf0) === 0xc0)?.data[1];
    const li = document.createElement("li");
    li.textContent = MUTE.has(ch)
      ? `Channel ${ch}: muted`
      : `Channel ${ch}: ${ch === 10 ? "drums" : program === undefined ? "no program" : `program ${program}`}, ${evs.filter((e) => (e.data[0] & 0xf0) === 0x90).length} notes`;
    $("parts").append(li);
  }
}

function stop(msg) {
  if (play) clearInterval(play.timer);
  play = null;
  if (output) {
    output.clear?.();
    for (const m of silence(ALL)) output.send(m);
  }
  $("play").classList.remove("on");
  $("status").textContent = msg || (output ? `Stopped. Port: ${output.name}` : $("status").textContent);
}

function start() {
  stop();
  if (!output) return;
  const t0 = performance.now() + 100;
  output.send(GM_ON, t0);
  for (const m of setup(band.events, 0)) output.send(m, t0 + 50);
  const beats = countIn ? 4 : 0; // one bar of side sticks on channel 10, at the file's first tempo
  for (let i = 0; i < beats; i++) output.send([0x99, 37, i ? 70 : 100], t0 + 100 + i * band.beatMs);
  play = { zero: t0 + 100 + beats * band.beatMs, sentTo: -Infinity };
  $("play").classList.add("on");
  const tick = () => {
    const now = performance.now() - play.zero;
    // between() is half-open, so consecutive windows send each event once
    for (const e of between(band.events, play.sentTo, now + LOOKAHEAD_MS)) output.send(e.data, play.zero + e.atMs);
    play.sentTo = now + LOOKAHEAD_MS;
    $("bar").value = Math.min(1, Math.max(0, now) / band.endMs);
    $("status").textContent = `${name}: ${clock(Math.max(0, now))} / ${clock(band.endMs)} on ${output.name}`;
    if (now > band.endMs + 1500) stop("Done.");
  };
  play.timer = setInterval(tick, 100);
  tick();
}

$("play").onclick = start;
$("stop").onclick = () => stop();
$("countin").onclick = (e) => {
  countIn = !countIn;
  e.currentTarget.textContent = `Count-in: ${countIn ? "on" : "off"}`;
  e.currentTarget.classList.toggle("on", countIn);
  e.currentTarget.setAttribute("aria-pressed", String(countIn));
};
$("pick").onchange = async (e) => {
  const f = e.target.files[0];
  if (f) load(await f.arrayBuffer(), f.name);
};
addEventListener("pagehide", () => stop());
addEventListener("keydown", (e) => e.key === "Escape" && stop());

if (q.get("file"))
  fetch(q.get("file"))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((b) => load(b, q.get("file")), (e) => ($("file").textContent = `${q.get("file")}: ${e.message}`));
if (!navigator.requestMIDIAccess) $("status").textContent = "This browser has no Web MIDI. Use Chrome.";
else
  navigator.requestMIDIAccess({ sysex: true }).then(
    (m) => {
      output = [...m.outputs.values()].find((o) => o.name.toLowerCase().includes(PORT.toLowerCase())) || null;
      $("status").textContent = output ? `Port: ${output.name}` : `No MIDI output named ${PORT}`;
    },
    () => ($("status").textContent = `No MIDI output named ${PORT} (MIDI access refused)`),
  );
