// Piano Arcade LED firmware (ESP32 + WS2812B over the keys).
//
// The browser owns the game. This board only turns serial messages into light:
// it maps a MIDI note to the LEDs over that key, fades released keys, flashes
// hits, and falls back to an idle animation when the browser goes quiet.
//
// Serial protocol (115200 baud). Status bytes have the high bit set and data
// bytes never do, like MIDI, so a dropped byte resyncs on the next message.
// Colors are 7-bit per channel (0-127), scaled to 0-254 here.
//
//   0x90 note r g b      key on  (key layer, full level, optional white flash)
//   0x80 note            key off (fades out over fadeMs)
//   0xA0 note r g b      hint layer, e.g. "play this next"; r=g=b=0 clears it
//   0xB0 param lo hi     set a setting to the 14-bit value lo | hi << 7 (table below)
//   0xC0 lo hi r g b     raw test: set one LED by index (bypasses key mapping)
//   0xF0                 clear everything
//   0xF1                 hello: replies with one text line, "PAL1 ..." + current settings
//   0xF2 id              ping: replies "PONG <id> <last show() in us> <LEDs driven>" right away,
//                        so the browser can measure the round trip and the frame cost
//   0xFE                 heartbeat: keeps the watchdog from releasing keys
//
// Settings (0xB0 param):
//   1 brightness 0-255     2 fadeMs           3 flash 0/1         4 attract 0/1 (idle lights)
//   5 hintPulseMs          hints breathe with this period (0 = steady). Motion catches the eye
//                          and reads on camera; a steady dim LED looks like a stuck pixel
//   6 rippleMs             each key on sends a ripple out both ways along the strip in the
//                          key's color, fading over this long (0 = off, the default: light stays on its key)
//   7 hintRampMs           a new hint starts nearly dark and brightens evenly, as the eye sees it, to twice
//                          its color over this long (0 = off: steady hint color, breathing). The game sends
//                          hints at half the hand color 600 ms before the note, so the key reaches the full
//                          hand color as the note lands. Then it breathes until it's cleared
//   8 wrongRed 0/1         a key released without ever lighting flashes red. The game sends a key off for
//                          every released key but a key on only for a judged note, so that's a wrong key
//                          (shown on release: the board never hears the press). Only during a song
//   9 shows 0/1            count-in and song-end animations (see "shows" below)
//   10 calLow  x16        LED position under the center of A0 (MIDI 21), in 1/16 LED
//   11 calHigh x16         LED position under the center of C8 (MIDI 108)
//   12 jointIndex          first LED of the second strip (144 for two 1 m strips)
//   13 jointGap x16        extra space at the joint, in 1/16 LED pitch (6.94 mm at 144/m)
//   14 reverse 0/1         strip runs right to left (DIN at the treble end)
//   15 demo 0/1             the shows' style: 0 classy (the default: brightness only, soft glows and fades, for
//                          learning and normal play), 1 demo (sparks, bursts, comets, fireworks: for demos).
//                          The board's BOOT button flips it and saves it
//   20 save                write settings to flash (survive power off)
//   21 defaults            reset settings to the compiled defaults (not saved until 20)

#include <FastLED.h>
#include <Preferences.h>
#include <math.h>

// ---- Hardware ----
#define DATA_PIN 18            // not a strapping pin; any free output GPIO works
#define BOOT_PIN 0             // the board's BOOT button: only matters at reset, a free input after it
#define BUTTON_DEBOUNCE_MS 40
#define NUM_LEDS 288           // two 1 m strips at 144/m, chained over JST
#define COLOR_ORDER GRB        // the BTF strips we bought are GRB
// Current cap. The PSU does 6 A, but the JST plug between the strips and the strip's thin
// copper are the weak links, so stay near a JST connector's ~3 A. Key lights alone draw
// well under 1 A; this only bites on full-strip effects.
#define MAX_MILLIAMPS 3000
#define SERIAL_BAUD 115200

// ---- Timing ----
#define FLASH_MS 120           // hit flash decay
#define WATCHDOG_MS 2500       // silence with keys held: release them (Chrome stalled)
#define IDLE_MS 8000           // no play this long (heartbeats, hello and pings don't count): idle lights
#define LINK_LOST_MS 3000      // no byte at all this long (the game beats every 1 s): no laptop is connected
#define STANDBY_LEDS 6         // idle with no laptop: only these first LEDs pulse, like a standby light
#define FRAME_MS 10            // frame period while only animating (fades, pulses): 100 fps
#define INPUT_FRAME_MS 2       // new input draws almost at once; the show() itself is ~5 ms
#define MAX_RIPPLES 12         // a fast run reuses the oldest ripple
#define RIPPLE_LEDS_PER_MS 0.09f  // ~62 cm/s: a hit spreads about two octaves before it fades
// LEDs look much brighter than their duty cycle (perceived brightness ~ duty^(1/2.2)), so a ramp that is
// straight in duty looks like it jumps on and then barely moves. The hint ramp is straight in what the eye
// sees: from HINT_START to 1, raised to HINT_GAMMA for the duty, times HINT_PEAK.
#define HINT_START 0.15f       // a fresh hint looks about 15% bright: there, but clearly "not yet"
#define HINT_GAMMA 2.2f
#define HINT_PEAK 2.0f         // hints arrive at half the hand color; the ramp ends at the full color
#define WRONG_HOLD_MS 300      // a wrong key's red stays full this long, then fades like any key
#define SHOW_LEVEL 150         // shows and idle lights draw at ~60%: they sit under the keys, never glare

const uint8_t LOW_NOTE = 21;   // A0
const uint8_t HIGH_NOTE = 108; // C8

struct Settings {
  uint16_t brightness = 110;   // 160 read as too bright on the piano (2026-10-25)
  uint16_t fadeMs = 180;
  uint16_t flash = 1;
  uint16_t attract = 1;
  uint16_t hintPulseMs = 900;
  float calLow = 4.0f;          // A0 sits a few LEDs in from the strip end
  float calHigh = 175.7f;       // 87 semitones x 1.974 LEDs (an octave is 164.5 mm = 23.7 LEDs)
  uint16_t jointIndex = 144;
  float jointGap = 0.0f;
  uint16_t reverse = 0;
  uint16_t rippleMs = 0;        // off: each key's light stays on its key. Setting 6 turns ripples back on
  uint16_t hintRampMs = 600;    // the game's hint lead (led-game leadMs)
  uint16_t wrongRed = 1;
  uint16_t shows = 1;
  uint16_t demo = 0;             // new fields go last: loadSettings reads an older, shorter save as a prefix
};

struct Key {
  CRGB color;      // key layer color while held or fading
  float level;     // 0..1, held = 1
  float flash;     // 0..1 white blend
  bool held;
  CRGB hint;       // hint layer
  uint32_t hintAt; // millis() when the hint last went from off to on
  uint32_t holdUntil; // a released key stays at full until then (a wrong key's red), then fades
};

struct Ripple {
  float center;    // LED index under the key that started it
  CRGB color;
  uint32_t start;
  bool on;
};

CRGB leds[NUM_LEDS];
Key keys[128];
Ripple ripples[MAX_RIPPLES];
int nextRipple = 0;
Settings cfg;
Preferences prefs;

uint32_t lastByteAt = 0;
uint32_t lastFrameAt = 0;
bool dirty = true;
bool attractOn = false;
bool watchdogFired = false;
uint32_t lastShowUs = 0;
int activeLeds = NUM_LEDS;  // show() only drives LEDs 0..activeLeds-1 (see updateActiveLeds)

// Raw test LEDs (0xC0) are kept apart from the key layers and drawn on top.
CRGB rawLeds[NUM_LEDS];
bool anyRaw = false;
uint32_t wrongFlashes = 0;  // wrong keys shown red since boot (the laptop tests count them)
uint32_t lastPlayAt = 0;    // last message that wasn't a heartbeat, hello or ping: idle lights wait IDLE_MS after it
void stopShows();           // shows, below
void idleTouch(uint8_t note);

// ---------------------------------------------------------------- geometry

// Keys are spaced evenly by semitone, not by real key shape. An octave is 7 white keys =
// 164.5 mm = 23.7 LEDs at 144/m, so each of the 12 notes gets ~1.98 LEDs: two LEDs per key,
// every key its own, and no LED shared between neighbours. The cost is that a key's light
// can sit up to ~6 mm off its real center, still well inside a 23.5 mm white key. (Placing
// black keys at their real spot puts them 1.7 LEDs from the next white key, so two-LED
// keys would overlap.)
//
// "Position" counts LED pitches along the strip, including any gap at the joint between
// the two strips, so it is linear in real distance. Calibration is two points: the
// position under A0 and under C8.
float notePosition(float note) {
  return cfg.calLow + (note - LOW_NOTE) * (cfg.calHigh - cfg.calLow) / (HIGH_NOTE - LOW_NOTE);
}

float ledPosition(int i) { return i < cfg.jointIndex ? i : i + cfg.jointGap; }

// Calls fn(index) for each LED whose position falls in this key's half-open slot, so
// neighbouring keys never share an LED.
template <typename F>
void forEachLed(uint8_t note, F fn) {
  if (note < LOW_NOTE || note > HIGH_NOTE) return;
  float lo = notePosition(note - 0.5f), hi = notePosition(note + 0.5f);
  if (lo > hi) { float t = lo; lo = hi; hi = t; }
  float center = notePosition(note);
  int nearest = -1, lit = 0;
  for (int i = max(0, (int)floorf(lo - cfg.jointGap) - 1); i < NUM_LEDS && i <= (int)ceilf(hi) + 1; i++) {
    float p = ledPosition(i);
    if (p >= lo && p < hi) { fn(cfg.reverse ? NUM_LEDS - 1 - i : i); lit++; }
    if (nearest < 0 || fabsf(p - center) < fabsf(ledPosition(nearest) - center)) nearest = i;
  }
  // A key whose slot falls in the joint gap borrows the nearest LED rather than going dark.
  if (!lit && nearest >= 0) fn(cfg.reverse ? NUM_LEDS - 1 - nearest : nearest);
}

// ---------------------------------------------------------------- settings

void loadSettings() {
  prefs.begin("pal", true);
  // Fields are only ever appended, so a save from older firmware is a valid prefix: the newer fields
  // keep their defaults and the calibration survives a reflash.
  size_t saved = prefs.getBytesLength("cfg");
  if (saved && saved <= sizeof(Settings)) prefs.getBytes("cfg", &cfg, saved);
  prefs.end();
}

void saveSettings() {
  prefs.begin("pal", false);
  prefs.putBytes("cfg", &cfg, sizeof(Settings));
  prefs.end();
}

// WS2812B data takes 30 us per LED, so show() on all 288 LEDs costs ~8.6 ms of latency on
// every frame. Only the LEDs under the keys (~178) need driving: trimming saves ~3 ms.
// LEDs past the end keep their last color, so blank the whole strip before shrinking.
// Reversed strips and raw tests (which can address any LED) drive the full strip.
void updateActiveLeds() {
  int want = NUM_LEDS;
  if (!cfg.reverse && !anyRaw) {
    want = 0;
    forEachLed(HIGH_NOTE, [&](int i) { want = max(want, i + 1); });
    if (want == 0) want = NUM_LEDS;
  }
  if (want == activeLeds) return;
  if (want < activeLeds) {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED[0].setLeds(leds, NUM_LEDS);
    FastLED.show();
  }
  activeLeds = want;
  FastLED[0].setLeds(leds, activeLeds);
}

void printHello() {
  Serial.printf("PAL1 leds=%d bright=%u fade=%u flash=%u attract=%u calLow=%.2f calHigh=%.2f "
                "joint=%u gap=%.2f reverse=%u pulse=%u ripple=%u ramp=%u wrong=%u shows=%u demo=%u active=%d\n",
                NUM_LEDS, cfg.brightness, cfg.fadeMs, cfg.flash, cfg.attract, cfg.calLow, cfg.calHigh,
                cfg.jointIndex, cfg.jointGap, cfg.reverse, cfg.hintPulseMs, cfg.rippleMs, cfg.hintRampMs,
                cfg.wrongRed, cfg.shows, cfg.demo, activeLeds);
}

void setParam(uint8_t param, uint16_t v) {
  switch (param) {
    case 1: cfg.brightness = min<uint16_t>(v, 255); FastLED.setBrightness(cfg.brightness); break;
    case 2: cfg.fadeMs = v; break;
    case 3: cfg.flash = v ? 1 : 0; break;
    case 4: cfg.attract = v ? 1 : 0; break;
    case 5: cfg.hintPulseMs = v; break;
    case 6: cfg.rippleMs = v; break;
    case 7: cfg.hintRampMs = v; break;
    case 8: cfg.wrongRed = v ? 1 : 0; break;
    case 9: cfg.shows = v ? 1 : 0; if (!cfg.shows) stopShows(); break;
    case 15: cfg.demo = v ? 1 : 0; break;
    case 10: cfg.calLow = v / 16.0f; break;
    case 11: cfg.calHigh = v / 16.0f; break;
    case 12: cfg.jointIndex = min<uint16_t>(v, NUM_LEDS); break;
    case 13: cfg.jointGap = v / 16.0f; break;
    case 14: cfg.reverse = v ? 1 : 0; break;
    case 20: saveSettings(); Serial.println("PAL1 saved"); return;
    case 21: cfg = Settings(); FastLED.setBrightness(cfg.brightness); break;
    default: return;
  }
  updateActiveLeds();
  printHello();  // echo, so the browser can show what the board actually has
}

// ---------------------------------------------------------------- serial

inline uint8_t scale7(uint8_t c) { return c >= 127 ? 255 : c << 1; }

// ---------------------------------------------------------------- shows
//
// Count-in and song-end animations, read from the game's messages alone. The game sends 0xF0 when a song
// starts and when it ends; through the count-in it sends only heartbeats, then the first note's hint
// (600 ms before it). So: a clear while no song is live starts the count-in show, which ends when the
// first hint arrives with a launch burst from that key; a clear while a song is live (a hint has come
// since the last clear) is the song's end, and fireworks play. Tools that send 0xF0 for other reasons
// (the tester's Clear) get a count-in show too, which stops at their next key on, raw LED or after
// INTRO_MAX_MS.

#define INTRO_MAX_MS 9000      // no hint by then: the count-in show stops
#define INTRO_STEPS 8          // the count-in is 8 beats (core settings' countInBeats): the bar fills in 8 steps
#define FINALE_MS 3500
#define MAX_SPARKS 48
#define TRAIL_FADE_PER_MS 1.6f // fx layer fades ~16/255 per 10 ms frame: a moving light leaves a short trail

// Pause: during a song the game sends a hint or a key every note, so PAUSE_MS of nothing but heartbeats means
// it's paused (Escape). The pause show runs until the next message of any other kind. A very long rest in a song,
// or wait mode holding on a note, looks the same; the show then stops at the next hint, which still leads its
// note by 600 ms.
#define PAUSE_MS 2000

enum Show : uint8_t { SHOW_NONE, SHOW_INTRO, SHOW_FINALE, SHOW_PAUSE };
uint16_t pauseSweeps = 0;  // comets launched in this pause show, and pause shows started since boot (tests count)
uint32_t pauseShows = 0;
Show showMode = SHOW_NONE;
uint32_t showStart = 0, nextBurstAt = 0;
// How long the count-in bar takes to fill: from the clear to the first hint. Twinkle measures 3.6 s (8 beats at
// 100 bpm, less the 600 ms hint lead and the game's start-up); every launch then sets it to what it just was, so
// a replayed song's bar lands exactly on the go.
uint32_t introExpectMs = 3600;
int introStep = -1;        // last count-in step drawn, to flash each new one once
bool songLive = false;     // a hint has arrived since the last clear: wrong keys show red, a clear is the end
bool showLive = false;     // the last frame still had a show, a spark or a trail on screen
CRGB fx[NUM_LEDS];         // the shows' layer, under the keys and faded every frame for trails

struct Spark {
  float pos, vel;          // LEDs, LEDs per ms
  CRGB color;
  uint32_t start;
  uint16_t life;           // ms; 0 = free
};
Spark sparks[MAX_SPARKS];
int nextSpark = 0;

void spark(float pos, float vel, CRGB color, uint16_t life) {
  sparks[nextSpark] = {pos, vel, color, millis(), life};
  nextSpark = (nextSpark + 1) % MAX_SPARKS;
}

// The game's Duo palette (web/src/game/ui-tokens): demo mode draws only in these, never a rainbow.
const CRGB UI_BLUE(0x2b, 0x9b, 0xff);     // handR, primary
const CRGB UI_VIOLET(0xa0, 0x7c, 0xff);   // handL, secondary
const CRGB UI_MAGENTA(0xff, 0x2f, 0xd0);  // hype: the big moments
const CRGB UI_GOLD(0xff, 0xe2, 0x7a);     // PERFECT
CRGB uiColor(uint8_t i) {
  switch (i % 4) {
    case 0: return UI_BLUE;
    case 1: return UI_VIOLET;
    case 2: return UI_MAGENTA;
    default: return UI_GOLD;
  }
}

// A firework at pos: sparks thrown both ways at random speeds in one color, every fourth one white.
void burst(float pos, CRGB color, int count, float speed) {
  for (int i = 0; i < count; i++) {
    float v = speed * (0.3f + random8() / 255.0f * 0.7f) * (i % 2 ? 1 : -1);
    CRGB c = color;
    c.nscale8_video(190 + random8(66));
    spark(pos, v, i % 4 == 0 ? CRGB(CRGB::White) : c, 500 + random16(700));
  }
}

// Classy (the default) draws every show with brightness alone: blooms, swells, breathing. Demo adds the sparks.
// Demo mode (setting 15) is the ripple: every hit breaks out both ways along the strip (rippleLife). The extra
// demo effects (sparks, bursts, comets, fireworks, shooting stars) stay behind DEMO_EXTRAS, off: Sharan wants demo to
// be just the ripple. With them off, every show is drawn the calm way in both modes.
#define DEMO_EXTRAS 0
inline bool demoExtras() { return DEMO_EXTRAS && cfg.demo; }
CRGB scale8Color(CRGB c, uint8_t v) { c.nscale8_video(v); return c; }

// A bloom: a soft glow that spreads from pos to `reach` LEDs either side and fades out, brightest in the middle.
// The classy stand-in for sparks and bursts.
#define MAX_BLOOMS 6
struct Bloom {
  float pos, reach;
  CRGB color;
  uint32_t start;
  uint16_t life;           // ms; 0 = free
};
Bloom blooms[MAX_BLOOMS];
int nextBloom = 0;

void bloom(float pos, CRGB color, uint16_t life, float reach) {
  blooms[nextBloom] = {pos, reach, color, millis(), life};
  nextBloom = (nextBloom + 1) % MAX_BLOOMS;
}

float ledCenterOf(uint8_t note) {
  float sum = 0;
  int n = 0;
  forEachLed(note, [&](int i) { sum += i; n++; });
  return n ? sum / n : activeLeds / 2.0f;
}

// Takes a plain uint8_t: the Arduino IDE writes prototypes above the enum, so a Show parameter won't compile.
void startShow(uint8_t s) {
  showMode = (Show)s;
  showStart = nextBurstAt = millis();
  introStep = -1;
  showLive = true;
}

void stopShows() {
  showMode = SHOW_NONE;
  for (auto &p : sparks) p.life = 0;
  for (auto &b : blooms) b.life = 0;
  memset(fx, 0, sizeof(fx));
  showLive = false;
}

// The first hint: the count-in is over. From the key the player is about to play: classy, a soft glow that
// blooms out over most of the strip; demo, a white shockwave both ways and two hands' worth of sparks.
void launch(uint8_t note) {
  showMode = SHOW_NONE;
  introExpectMs = min<uint32_t>(8000, max<uint32_t>(1500, millis() - showStart));
  float c = ledCenterOf(note);
  if (!demoExtras()) { bloom(c, CRGB(110, 120, 170), 1100, 60); return; }
  spark(c, 0.35f, CRGB::White, 450);
  spark(c, -0.35f, CRGB::White, 450);
  burst(c, UI_VIOLET, 10, 0.15f);
  burst(c, UI_BLUE, 10, 0.15f);
}

// Count-in as a charge bar: violet (left hand) fills in from the bass end and blue (right hand) from the treble end, one step per beat
// (INTRO_STEPS), meeting in the middle at the expected go; the bar gets brighter with every step. Classy: each
// new step fades in over 300 ms and the bar barely shimmers. Demo: each step flashes the bar, throws sparks off
// its two edges, and the edges burn white. Full and still no hint (a slower song than the last): it breathes.
void drawIntro(uint32_t t) {
  float p = min(1.0f, (float)t / introExpectMs);
  int step = min(INTRO_STEPS, (int)(p * INTRO_STEPS) + 1);  // steps lit: 1 at the clear, all 8 by the go
  float mid = (activeLeds - 1) / 2.0f;
  float edge = mid * step / INTRO_STEPS;                     // how far each side reaches
  float lastEdge = mid * (step - 1) / INTRO_STEPS;           // where the newest step starts
  uint32_t sinceStep = t - (uint32_t)((step - 1) * (float)introExpectMs / INTRO_STEPS);
  bool fresh = step != introStep;
  introStep = step;
  if (fresh && demoExtras()) {
    spark(edge, 0.08f, UI_VIOLET, 500);
    spark(activeLeds - 1 - edge, -0.08f, UI_BLUE, 500);
  }
  uint8_t flash = demoExtras() && sinceStep < 150 ? 255 - sinceStep * 255 / 150 : 0;  // demo: each step flashes 150 ms
  uint8_t fadeIn = demoExtras() || sinceStep >= 300 ? 255 : sinceStep * 255 / 300;     // classy: each step fades in
  uint8_t base = 70 + step * 14;                                                 // brighter with every step
  if (p >= 1) base = 90 + scale8(sin8(t / 4), 80);                               // full: breathe until the hint
  uint8_t shimmer = demoExtras() ? 55 : 20;
  for (int i = 0; i < activeLeds; i++) {
    bool left = i <= mid;
    float d = left ? i : activeLeds - 1 - i;  // distance in from its own end
    if (d > edge) continue;
    uint8_t v = qadd8(scale8(base, 255 - shimmer + scale8(sin8(i * 11 + t / 3), shimmer)), scale8(flash, 120));
    if (d > lastEdge) v = scale8(v, fadeIn);
    CRGB c = left ? UI_VIOLET : UI_BLUE;  // the hands: left (bass) violet, right (treble) blue
    c.nscale8_video(v);
    fx[i] |= c;
    if (demoExtras() && d > edge - 1.5f) fx[i] |= CRGB(v, v, v);  // the edge burns white
  }
}

// ---------------------------------------------------------------- fever
//
// The game's fever gauge (spec: fever-gauge), mirrored from the hit colors the game already sends: PERFECT adds 1,
// GREAT 0.5, GOOD 0, and a full gauge starts FEVER, which lasts until the combo breaks. Before fever a miss or a
// wrong key halves the gauge; during it, the break ends fever and empties the gauge. The gauge holds a quarter of
// the song's notes (12 to 50). The board can't count a song before playing it, so it starts at 12 (Twinkle's) and
// then uses each song's own count from its last play. If the game's colors change, nothing matches and fever just
// never starts on the strip.

enum Judged : uint8_t { J_NONE, J_PERFECT, J_GREAT, J_GOOD, J_MISS };
float gaugeFill = 0;
uint8_t gaugeSize = 12;
uint16_t songJudged = 0;   // judged notes this song: next play's gauge size
bool fever = false;
float feverGlow = 0;       // 0..1: eases in when fever starts, gone at a break

bool near7(const uint8_t *m, uint8_t r, uint8_t g, uint8_t b) {
  return abs(m[2] - r) <= 1 && abs(m[3] - g) <= 1 && abs(m[4] - b) <= 1;
}

// A key on's judgment from its color: the HUD's judgment colors (ui-tokens) as the game scales them to 0-127.
uint8_t judgedFrom(const uint8_t *m) {
  if (near7(m, 127, 113, 61)) return J_PERFECT;  // gold #ffe27a
  if (near7(m, 47, 121, 98)) return J_GREAT;     // #5ef2c4
  if (near7(m, 62, 91, 127)) return J_GOOD;      // #7cb7ff
  if (near7(m, 127, 38, 47)) return J_MISS;      // #ff4d5e: led-game lights a miss in the wrong-note red
  return J_NONE;
}

// A miss or a wrong key. During fever it breaks: classy, the glow fades out through a soft red; demo, it
// shatters, red sparks from the key and the glow collapses red.
void feverBreak(uint8_t note) {
  if (!fever) { gaugeFill /= 2; return; }
  fever = false;
  gaugeFill = 0;
  feverGlow = 0;
  if (!demoExtras()) {
    for (int i = 0; i < activeLeds; i++) fx[i] |= CRGB(50, 0, 4);
    return;
  }
  float c = ledCenterOf(note);
  for (int i = 0; i < 16; i++)
    spark(c, (0.05f + random8() / 255.0f * 0.25f) * (i % 2 ? 1 : -1), CRGB(255, random8(40), 0), 400 + random16(500));
  for (int i = 0; i < activeLeds; i++) fx[i] |= CRGB(90, 0, 0);
}

void feverHit(uint8_t note, uint8_t j) {
  songJudged++;
  if (j == J_MISS) { feverBreak(note); return; }
  float c = ledCenterOf(note);
  if (fever) {  // every hit in fever: classy, a small warm bloom; demo, pulses out both ways
    if (!demoExtras()) { bloom(c, CRGB(120, 80, 20), 450, 6); return; }
    spark(c, 0.3f, UI_GOLD, 350);
    spark(c, -0.3f, UI_MAGENTA, 350);
    return;
  }
  gaugeFill = min((float)gaugeSize, gaugeFill + (j == J_PERFECT ? 1.0f : j == J_GREAT ? 0.5f : 0.0f));
  if (gaugeFill >= gaugeSize) {  // FEVER. Classy: a warm swell from this key. Demo: a gold flash and a burst
    fever = true;
    if (!demoExtras()) { bloom(c, CRGB(150, 100, 25), 1500, 90); return; }
    for (int i = 0; i < activeLeds; i++) fx[i] |= CRGB(150, 110, 20);
    burst(c, UI_GOLD, 20, 0.2f);
  }
}

// At a clear. A song's end also sizes the next play's gauge from this one's notes.
void feverReset(bool songEnded) {
  if (songEnded && songJudged >= 8) gaugeSize = min(50, max(12, (int)(songJudged * 0.25f + 0.5f)));
  songJudged = 0;
  gaugeFill = 0;
  fever = false;
  feverGlow = 0;
}

// During fever, a glow under the keys: pink through orange to gold, flowing toward the treble, at most ~80 of 255
// so hints and hits stay on top (classy: the flow is slower and the whole glow breathes). Before fever, the
// gauge shows: classy, a faint warm underglow that rises as it fills; demo, gold embers sparking more often.
bool drawFever(uint32_t now, float dt) {
  if (!cfg.shows) { feverGlow = 0; return false; }  // shows off: the gauge still counts, nothing draws
  feverGlow = fever ? min(1.0f, feverGlow + dt / (demoExtras() ? 400 : 900)) : 0;
  if (feverGlow > 0) {
    uint8_t breath = demoExtras() ? 255 : 190 + scale8(sin8(now / 9), 65);
    for (int i = 0; i < activeLeds; i++) {
      uint8_t hue = 232 + scale8(sin8(i * 3 + now / 13), 70);  // wraps past 255: pink, red, orange, gold
      uint8_t wave = sin8(i * 6 - now / (demoExtras() ? 5 : 14));
      uint8_t v = scale8(demoExtras() ? 26 + scale8(wave, 54) : 45 + scale8(wave, 75), (uint8_t)(feverGlow * breath));
      fx[i] |= CRGB(CHSV(hue, 230, v));
    }
    return true;
  }
  if (!songLive || gaugeFill <= 0) return false;
  float full = gaugeFill / gaugeSize;
  if (!demoExtras()) {
    uint8_t v = (uint8_t)(6 + 45 * full);
    v = scale8(v, 215 + scale8(sin8(now / 8), 40));
    for (int i = 0; i < activeLeds; i++) fx[i] |= CRGB(CHSV(32, 210, v));
    return true;
  }
  if (random8() < (uint8_t)(70 * full)) fx[random16(activeLeds)] += CRGB(CHSV(36, 190, 50 + (uint8_t)(130 * full)));
  return false;
}

// Moves the shows on one frame. Returns true while anything is still on screen.
bool renderShow(uint32_t now, float dt) {
  fadeToBlackBy(fx, activeLeds, (uint8_t)min(255.0f, dt * TRAIL_FADE_PER_MS));
  bool live = false;
  uint32_t t = now - showStart;
  if (showMode == SHOW_INTRO) {
    if (t > INTRO_MAX_MS) showMode = SHOW_NONE;
    else { drawIntro(t); live = true; }
  } else if (showMode == SHOW_FINALE) {
    if (t > FINALE_MS) showMode = SHOW_NONE;
    else if (!demoExtras()) {
      // Classy: a warm gold wash swells out from the middle over 1 s, shimmers gently, and fades away.
      float mid = (activeLeds - 1) / 2.0f;
      float reach = mid * 1.1f * min(1.0f, t / 1000.0f);
      float env = t < 1000 ? 1.0f : 1.0f - (float)(t - 1000) / (FINALE_MS - 1000);
      for (int i = 0; i < activeLeds; i++) {
        float d = fabsf(i - mid);
        if (d > reach) continue;
        uint8_t v = (uint8_t)(170 * env * (1 - 0.6f * d / (reach + 1)));
        fx[i] |= CRGB(CHSV(30 + scale8(sin8(i * 4 + t / 10), 18), 200, v));
      }
      live = true;
    } else {
      if ((int32_t)(now - nextBurstAt) >= 0) {
        burst(random16(activeLeds), uiColor(random8()), 12, 0.12f);
        nextBurstAt = now + 180 + random16(220);
      }
      live = true;
    }
  } else if (showMode == SHOW_PAUSE && !demoExtras()) {
    // Classy pause: the whole strip breathes slowly in violet, the paused hint on top.
    uint8_t in = t < 600 ? t * 255 / 600 : 255;
    uint8_t v = scale8(12 + scale8(sin8(t / 8), 45), in);
    for (int i = 0; i < activeLeds; i++) fx[i] |= CRGB(CHSV(196, 190, v));
    live = true;
  } else if (showMode == SHOW_PAUSE) {
    // A dim blue-violet river under comets in the UI colors sweeping the whole strip, alternating sides every 300 ms, and a
    // burst every fourth sweep. The paused hint still draws on top. Fades in over 400 ms.
    uint8_t in = t < 400 ? t * 255 / 400 : 255;
    for (int i = 0; i < activeLeds; i++) {
      CRGB river = blend(UI_BLUE, UI_VIOLET, sin8(i * 3 + now / 8));
      river.nscale8_video(scale8(30, in));
      fx[i] |= river;
    }
    if ((int32_t)(now - nextBurstAt) >= 0) {
      bool fromBass = pauseSweeps++ & 1;
      spark(fromBass ? 0 : activeLeds - 1, fromBass ? 0.32f : -0.32f, uiColor(pauseSweeps), 900);
      if (pauseSweeps % 4 == 0) burst(random16(activeLeds), uiColor(random8()), 10, 0.12f);
      nextBurstAt = now + 300;
    }
    live = true;
  }
  if (drawFever(now, dt)) live = true;
  for (auto &p : sparks) {
    if (!p.life) continue;
    uint32_t age = now - p.start;
    if (age >= p.life) { p.life = 0; continue; }
    live = true;
    float u = (float)age / p.life;
    int i = (int)roundf(p.pos + p.vel * age * (1 - u * 0.5f));  // slows as it burns out
    if (i < 0 || i >= activeLeds) continue;
    CRGB c = p.color;
    c.nscale8_video((uint8_t)(255 * (1 - u) * (1 - u)));
    fx[i] += c;
  }
  for (auto &b : blooms) {
    if (!b.life) continue;
    uint32_t age = now - b.start;
    if (age >= b.life) { b.life = 0; continue; }
    live = true;
    float u = (float)age / b.life;
    float r = 1.5f + b.reach * sqrtf(u);  // spreads fast at first, then slows
    float amp = (1 - u) * (1 - u);        // and fades out
    for (int i = max(0, (int)(b.pos - r)); i <= min(activeLeds - 1, (int)(b.pos + r)); i++) {
      float w = 1 - fabsf(i - b.pos) / r;
      if (w <= 0) continue;
      CRGB c = b.color;
      c.nscale8_video((uint8_t)(255 * amp * w * w));
      fx[i] |= c;
    }
  }
  for (int i = 0; !live && i < activeLeds; i++) if (fx[i]) live = true;  // trails still fading
  return live;
}

// ---------------------------------------------------------------- idle lights
//
// No play for IDLE_MS (the game's heartbeats, hellos and pings don't count) and no song live: an aurora of
// the game's colors drifts along the keys, a shooting star crosses every few seconds, and a key released on
// the piano throws sparks from that key (if the game passes releases on while no song is playing). Any play
// message ends it at once. With no board connected at all it runs too: a strip that sits there looking alive.

uint32_t idleStart = 0, nextStarAt = 0;

void startIdle(uint32_t now) {
  stopShows();
  idleStart = now;
  nextStarAt = now + 2500;
}

// A key touched while idle, in a color picked by its pitch: classy, a soft glow blooms from it; demo, sparks
// from it plus a white flare.
void idleTouch(uint8_t note) {
  if (note < LOW_NOTE || note > HIGH_NOTE) return;
  float c = ledCenterOf(note);
  CRGB tone = blend(UI_VIOLET, UI_BLUE, (note - LOW_NOTE) * 255 / (HIGH_NOTE - LOW_NOTE));  // bass violet, treble blue
  if (!demoExtras()) { bloom(c, scale8Color(tone, 170), 900, 14); return; }
  burst(c, tone, 10, 0.12f);
  spark(c, 0, CRGB::White, 300);
}

// A soft glow over the whole strip with two waves of light flowing through it: a big one rolling up toward
// the treble (~50 LEDs a second) and a smaller, slower one rolling back. Squaring each wave turns it into a
// distinct band instead of a wash. The hue sways between cyan, violet and pink. Peaks near 170 of 255 before
// the master brightness, so it reads across a room without glaring. Fades in over 1.5 s.
// Idle shows whether a laptop is on the other end: with the game connected (its heartbeat), the aurora; with no
// byte for LINK_LOST_MS, a standby light instead, a slow dim blue pulse on the first STANDBY_LEDS at the bass end
// and the rest dark. Switching either way fades the new look in again.
bool idleLinked = true;

void renderIdle(uint32_t now, float dt) {
  bool linked = now - lastByteAt < LINK_LOST_MS;
  if (linked != idleLinked) { idleLinked = linked; idleStart = now; }
  if (!linked) {
    showLive = renderShow(now, dt);  // let any last sparks finish, but draw none of them
    uint8_t breath = 6 + scale8(sin8((now - idleStart) / 12 + 192), 50);  // ~3 s a breath, starting dark
    for (int i = 0; i < activeLeds; i++) {
      leds[i] = CRGB::Black;
      if (i >= STANDBY_LEDS) continue;
      CRGB c = UI_BLUE;
      c.nscale8_video(scale8(breath, 255 - i * 255 / STANDBY_LEDS));  // brightest at the end, tapering in
      leds[i] = c;
    }
    return;
  }
  showLive = renderShow(now, dt);  // stars and touch sparks
  uint32_t t = now - idleStart;
  uint8_t fadeIn = t < 1500 ? t * 255 / 1500 : 255;
  for (int i = 0; i < activeLeds; i++) {
    uint8_t up = sin8(i * 3 - now / 6), back = sin8(i * 5 + now / 11);
    uint8_t v = qadd8(qadd8(22, scale8(scale8(up, up), 120)), scale8(scale8(back, back), 50));
    uint8_t hue = 150 + scale8(sin8(i * 2 + now / 50), 65);  // blue, violet, magenta: the UI's, no green
    leds[i] = CHSV(hue, 210, scale8(scale8(v, fadeIn), SHOW_LEVEL));
    CRGB f = fx[i];
    f.nscale8_video(SHOW_LEVEL);
    leds[i] += f;
  }
  if (demoExtras() && (int32_t)(now - nextStarAt) >= 0) {  // shooting stars are demo only
    bool fromBass = random8() & 1;
    spark(fromBass ? 0 : activeLeds - 1, fromBass ? 0.2f : -0.2f, CRGB(200, 220, 255), 1400);
    nextStarAt = now + 3000 + random16(4000);
  }
}

void clearAll() {
  for (auto &k : keys) k = Key();
  for (auto &r : ripples) r.on = false;
  memset(rawLeds, 0, sizeof(rawLeds));
  if (anyRaw) { anyRaw = false; updateActiveLeds(); }
}

// How long a key on's ripple lasts: setting 6 if set; otherwise demo mode brings it back at 700 ms (the hit
// "breaks to both sides", as the strip first did) and classy keeps each key's light on its key.
uint16_t rippleLife() { return cfg.rippleMs ? cfg.rippleMs : cfg.demo && cfg.shows ? 700 : 0; }

void startRipple(uint8_t note, CRGB color) {
  if (!rippleLife()) return;
  float sum = 0;
  int n = 0;
  forEachLed(note, [&](int i) { sum += i; n++; });
  if (!n) return;
  ripples[nextRipple] = {sum / n, color, millis(), true};
  nextRipple = (nextRipple + 1) % MAX_RIPPLES;
}

// Runs one complete message. buf[0] is the status byte.
void runMessage(const uint8_t *m) {
  // Idle lights: a key released with no song live is someone touching the piano: sparkle, stay idle.
  // Anything else but a heartbeat, hello or ping is play, and ends idle.
  bool touch = attractOn && m[0] == 0x80 && !songLive;
  if (touch) idleTouch(m[1]);
  else if (m[0] != 0xFE && m[0] != 0xF1 && m[0] != 0xF2) {
    lastPlayAt = millis();
    if (attractOn) { attractOn = false; stopShows(); }
    if (showMode == SHOW_PAUSE) stopShows();  // resumed
  }
  switch (m[0]) {
    case 0x90: {
      Key &k = keys[m[1]];
      k.color = CRGB(scale7(m[2]), scale7(m[3]), scale7(m[4]));
      k.level = 1.0f;
      k.held = true;
      k.holdUntil = 0;
      k.flash = cfg.flash ? 1.0f : 0.0f;
      if (showMode == SHOW_INTRO) showMode = SHOW_NONE;  // a key on before any hint: not a count-in
      // A hint still on after a hit is for this key's next note (the game keeps one hint lit across
      // a repeated note), so its ramp starts over from the hit. It shows once the key's light fades.
      if (k.hint) k.hintAt = millis();
      startRipple(m[1], k.color);
      if (songLive) {
        uint8_t j = judgedFrom(m);
        if (j) feverHit(m[1], j);
      }
      break;
    }
    case 0x80: {
      Key &k = keys[m[1]];
      // A release of a key that isn't lit: the game never sent its key on, so it was a wrong key.
      if (cfg.wrongRed && songLive && !k.held && k.level <= 0 && m[1] >= LOW_NOTE && m[1] <= HIGH_NOTE) {
        k.color = CRGB::Red;
        k.level = 1.0f;
        k.flash = 0;
        k.holdUntil = millis() + WRONG_HOLD_MS;
        wrongFlashes++;
        feverBreak(m[1]);  // a wrong key breaks the combo, like the game's wrongNote
      }
      k.held = false;
      if (cfg.fadeMs == 0 && !k.holdUntil) k.level = 0;
      break;
    }
    case 0xA0: {
      Key &k = keys[m[1]];
      CRGB h = CRGB(scale7(m[2]), scale7(m[3]), scale7(m[4]));
      if (h && !k.hint) k.hintAt = millis();  // a recolor keeps its ramp; only off to on restarts it
      k.hint = h;
      if (h) {
        if (showMode == SHOW_INTRO) launch(m[1]);
        songLive = true;
      }
      break;
    }
    case 0xB0: setParam(m[1], m[2] | (m[3] << 7)); break;
    case 0xC0: {
      int i = m[1] | (m[2] << 7);
      if (i < NUM_LEDS) {
        rawLeds[i] = CRGB(scale7(m[3]), scale7(m[4]), scale7(m[5]));
        if (!anyRaw) { anyRaw = true; updateActiveLeds(); }
        stopShows();  // a raw LED test wants a dark strip around it
      }
      break;
    }
    case 0xF0: {
      bool ending = songLive;
      clearAll();
      feverReset(ending);
      songLive = false;
      stopShows();
      if (cfg.shows) startShow(ending ? SHOW_FINALE : SHOW_INTRO);
      break;
    }
    case 0xF1: printHello(); break;
    case 0xF2: Serial.printf("PONG %u %u %d\n", m[1], (unsigned)lastShowUs, activeLeds); break;
    case 0xFE: break;
  }
  dirty = true;
}

int messageLength(uint8_t status) {
  switch (status) {
    case 0x90: case 0xA0: return 5;
    case 0x80: case 0xF2: return 2;
    case 0xB0: return 4;
    case 0xC0: return 6;
    case 0xF0: case 0xF1: case 0xFE: return 1;
    default: return 0;  // unknown status: ignore until the next one
  }
}

uint8_t msg[8];
int msgLen = 0, msgNeed = 0;

void readSerial() {
  while (Serial.available()) {
    uint8_t b = Serial.read();
    lastByteAt = millis();
    watchdogFired = false;
    if (b & 0x80) {
      msgNeed = messageLength(b);
      msgLen = 0;
      if (msgNeed == 0) continue;
      msg[msgLen++] = b;
    } else if (msgNeed == 0 || msgLen == 0) {
      continue;  // stray data byte, wait for a status byte
    } else {
      msg[msgLen++] = b;
    }
    if (msgLen == msgNeed) { runMessage(msg); msgNeed = 0; msgLen = 0; }
  }
}

// ---------------------------------------------------------------- render

// Returns true while something is still animating.
bool stepAnimations(float dtMs, uint32_t now) {
  bool animating = false;
  if (cfg.hintPulseMs || cfg.hintRampMs)
    for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) if (keys[n].hint) { animating = true; break; }
  for (auto &k : keys) {
    if (k.flash > 0) { k.flash = max(0.0f, k.flash - dtMs / FLASH_MS); animating = true; }
    if (!k.held && k.level > 0) {
      if ((int32_t)(now - k.holdUntil) >= 0) {
        k.holdUntil = 0;
        k.level = cfg.fadeMs ? max(0.0f, k.level - dtMs / cfg.fadeMs) : 0.0f;
      }
      animating = true;
    }
  }
  for (auto &r : ripples) if (r.on) { animating = true; break; }
  return animating;
}

// Two wavefronts per ripple, one each way, 2 LEDs wide on either side. They start at 55% and fade
// quadratically, so the key itself stays the brightest thing and a chord's ripples add up without
// washing out. A ripple turns off on the frame it expires, and that frame draws it dark.
void renderRipples(uint32_t now) {
  for (auto &r : ripples) {
    if (!r.on) continue;
    uint32_t age = now - r.start;
    uint16_t life = rippleLife();
    if (age >= life) { r.on = false; continue; }
    float u = (float)age / life, amp = 0.55f * (1 - u) * (1 - u);
    float radius = age * RIPPLE_LEDS_PER_MS;
    for (int side = -1; side <= 1; side += 2) {
      float p = r.center + side * radius;
      for (int i = max(0, (int)floorf(p - 2)); i <= (int)ceilf(p + 2) && i < activeLeds; i++) {
        float w = 1 - fabsf(i - p) / 2.0f;
        if (w <= 0) continue;
        CRGB c = r.color;
        c.nscale8_video((uint8_t)(amp * w * 255));
        leds[i] += c;  // saturating add
      }
    }
  }
}

// How bright a hint is drawn, as a multiple of its color (0 to HINT_PEAK). With the ramp on, a new hint
// rises evenly as the eye sees it from HINT_START to the peak over hintRampMs, then a late note's hint
// breathes between 70% and 100% of the peak as seen; the breath starts at its top, so there's no jump.
// With the ramp off it's the hint color breathing 35% to 100% in duty, as before the ramp existed.
float hintFactor(const Key &k, uint32_t now) {
  uint32_t age = now - k.hintAt;
  uint8_t breath = 255;  // 255 at the top of each breath
  if (cfg.hintPulseMs) {
    uint32_t t = cfg.hintRampMs && age >= cfg.hintRampMs ? age - cfg.hintRampMs : age;
    breath = sin8((uint8_t)((t % cfg.hintPulseMs) * 256 / cfg.hintPulseMs + 64));
  }
  if (!cfg.hintRampMs) return (90 + scale8(breath, 165)) / 255.0f;
  float seen = age < cfg.hintRampMs ? HINT_START + (1 - HINT_START) * age / cfg.hintRampMs
                                    : 0.7f + 0.3f * breath / 255.0f;
  return HINT_PEAK * powf(seen, HINT_GAMMA);
}

// c times f, for f from 0 to 2: above 1 the color is added to itself (saturating), so the half-strength
// hint color the game sends doubles back to its full hand color.
CRGB scaleBy(CRGB c, float f) {
  CRGB out = c;
  if (f >= 1) {
    CRGB extra = c;
    extra.nscale8_video((uint8_t)min(255.0f, (f - 1) * 255));
    return out + extra;
  }
  out.nscale8_video((uint8_t)(f * 255));
  return out;
}

void renderKeys(uint32_t now) {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  for (int i = 0; i < activeLeds; i++) {  // shows first, at SHOW_LEVEL: keys and hints draw over them
    leds[i] = fx[i];
    leds[i].nscale8_video(SHOW_LEVEL);
  }
  renderRipples(now);  // under the keys: a lit key's own color wins on its LEDs
  for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) {
    Key &k = keys[n];
    CRGB c = CRGB::Black;
    if (k.level > 0) {
      c = k.color;
      if (k.flash > 0) c = blend(c, CRGB::White, (uint8_t)(k.flash * 200));
      c.nscale8_video((uint8_t)(k.level * 255));
    } else if (k.hint) {
      c = scaleBy(k.hint, hintFactor(k, now));  // the key layer wins over the hint while a key is lit
    }
    if (!c) continue;
    forEachLed(n, [&](int i) { leds[i] |= c; });  // overlapping keys: brightest channel wins
  }
  if (anyRaw) for (int i = 0; i < NUM_LEDS; i++) leds[i] |= rawLeds[i];
}

// ---------------------------------------------------------------- main

void bootTest() {
  // Hour-0 test, every boot: lowest key red, highest key blue for one second. If both
  // light over the right keys in the right colors, power, data, color order, direction
  // and calibration are all fine.
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  forEachLed(LOW_NOTE, [](int i) { leds[i] = CRGB::Red; });
  forEachLed(HIGH_NOTE, [](int i) { leds[i] = CRGB::Blue; });
  FastLED.show();
  delay(1000);
  FastLED.clear(true);
}

void show() {
  uint32_t t = micros();
  FastLED.show();
  lastShowUs = micros() - t;
}

// ---------------------------------------------------------------- BOOT button
//
// The board's BOOT button flips the shows between classy and demo, saves it, and shows which: demo, comets in the UI
// colors out both ways from the middle; classy, a soft white glow blooming from the middle. (BOOT only
// matters while the board resets; after that GPIO0 is a free input.)

#ifdef ARDUINO
bool bootDown() { return digitalRead(BOOT_PIN) == LOW; }
#else
bool hostBootDown = false;  // the laptop tests press it
bool bootDown() { return hostBootDown; }
#endif
bool bootWas = false;
uint32_t bootChangedAt = 0;

void checkBootButton(uint32_t now) {
  bool down = bootDown();
  if (down == bootWas || now - bootChangedAt < BUTTON_DEBOUNCE_MS) return;
  bootWas = down;
  bootChangedAt = now;
  if (!down) return;  // act on the press, not the release
  cfg.demo = !cfg.demo;
  saveSettings();
  printHello();  // the tester shows the new mode
  float mid = (activeLeds - 1) / 2.0f;
  if (cfg.demo) {
    for (int k = 0; k < 6; k++) {
      spark(mid, 0.22f + k * 0.03f, uiColor(k), 900);
      spark(mid, -(0.22f + k * 0.03f), uiColor(k + 1), 900);
    }
  } else {
    bloom(mid, CRGB(150, 150, 170), 1200, mid);
  }
  showLive = dirty = true;
}

void setup() {
  Serial.setRxBufferSize(1024);
  Serial.begin(SERIAL_BAUD);
#ifdef ARDUINO
  pinMode(BOOT_PIN, INPUT_PULLUP);
#endif
  loadSettings();
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, MAX_MILLIAMPS);
  FastLED.setBrightness(cfg.brightness);
  FastLED.setDither(0);  // dithering flickers at low levels on 144/m strips
  bootTest();
  updateActiveLeds();
  lastByteAt = lastPlayAt = millis();
  // Opening the port from Chrome resets the board (DTR/RTS auto-reset), so the
  // browser should wait for this line before sending anything.
  printHello();
}

void loop() {
  readSerial();
  uint32_t now = millis();
  checkBootButton(now);

  // Chrome has stalled before (minutes without MIDI). Don't leave keys stuck on.
  if (!watchdogFired && now - lastByteAt > WATCHDOG_MS) {
    for (auto &k : keys) k.held = false;
    watchdogFired = true;
    dirty = true;
  }
  if (cfg.shows && songLive && showMode == SHOW_NONE && now - lastPlayAt > PAUSE_MS) {
    startShow(SHOW_PAUSE);
    pauseSweeps = 0;
    pauseShows++;
  }
  if (cfg.attract && !attractOn && !songLive && showMode == SHOW_NONE && now - lastPlayAt > IDLE_MS) {
    clearAll();
    attractOn = true;
    startIdle(now);
  }

  // New input jumps the queue: it waits at most INPUT_FRAME_MS, not a whole animation frame.
  if (now - lastFrameAt < (dirty ? INPUT_FRAME_MS : FRAME_MS)) return;
  float dt = now - lastFrameAt;
  lastFrameAt = now;

  if (attractOn) {
    renderIdle(now, dt);
    show();
    return;
  }
  bool animating = stepAnimations(dt, now);
  if (dirty || animating || showLive || showMode != SHOW_NONE) {
    showLive = renderShow(now, dt);
    renderKeys(now);
    show();
    dirty = false;
  }
}
