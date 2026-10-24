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
//   1 brightness 0-255     2 fadeMs           3 flash 0/1         4 attract 0/1
//   5 hintPulseMs          hints breathe with this period (0 = steady). Motion catches the eye
//                          and reads on camera; a steady dim LED looks like a stuck pixel
//   6 rippleMs             each key on sends a ripple out both ways along the strip in the
//                          key's color, fading over this long (0 = off). Hits read from across the room
//   10 calLow  x16        LED position under the center of A0 (MIDI 21), in 1/16 LED
//   11 calHigh x16         LED position under the center of C8 (MIDI 108)
//   12 jointIndex          first LED of the second strip (144 for two 1 m strips)
//   13 jointGap x16        extra space at the joint, in 1/16 LED pitch (6.94 mm at 144/m)
//   14 reverse 0/1         strip runs right to left (DIN at the treble end)
//   20 save                write settings to flash (survive power off)
//   21 defaults            reset settings to the compiled defaults (not saved until 20)

#include <FastLED.h>
#include <Preferences.h>
#include <math.h>

// ---- Hardware ----
#define DATA_PIN 18            // not a strapping pin; any free output GPIO works
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
#define ATTRACT_MS 15000       // silence this long: idle animation
#define FRAME_MS 10            // frame period while only animating (fades, pulses): 100 fps
#define INPUT_FRAME_MS 2       // new input draws almost at once; the show() itself is ~5 ms
#define MAX_RIPPLES 12         // a fast run reuses the oldest ripple
#define RIPPLE_LEDS_PER_MS 0.09f  // ~62 cm/s: a hit spreads about two octaves before it fades

const uint8_t LOW_NOTE = 21;   // A0
const uint8_t HIGH_NOTE = 108; // C8

struct Settings {
  uint16_t brightness = 160;
  uint16_t fadeMs = 180;
  uint16_t flash = 1;
  uint16_t attract = 1;
  uint16_t hintPulseMs = 900;
  float calLow = 4.0f;          // A0 sits a few LEDs in from the strip end
  float calHigh = 175.7f;       // 87 semitones x 1.974 LEDs (an octave is 164.5 mm = 23.7 LEDs)
  uint16_t jointIndex = 144;
  float jointGap = 0.0f;
  uint16_t reverse = 0;
  uint16_t rippleMs = 700;      // last, so the saved-settings size check drops older saves cleanly
};

struct Key {
  CRGB color;      // key layer color while held or fading
  float level;     // 0..1, held = 1
  float flash;     // 0..1 white blend
  bool held;
  CRGB hint;       // hint layer
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
  if (prefs.getBytesLength("cfg") == sizeof(Settings)) prefs.getBytes("cfg", &cfg, sizeof(Settings));
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
                "joint=%u gap=%.2f reverse=%u pulse=%u ripple=%u active=%d\n",
                NUM_LEDS, cfg.brightness, cfg.fadeMs, cfg.flash, cfg.attract, cfg.calLow, cfg.calHigh,
                cfg.jointIndex, cfg.jointGap, cfg.reverse, cfg.hintPulseMs, cfg.rippleMs, activeLeds);
}

void setParam(uint8_t param, uint16_t v) {
  switch (param) {
    case 1: cfg.brightness = min<uint16_t>(v, 255); FastLED.setBrightness(cfg.brightness); break;
    case 2: cfg.fadeMs = v; break;
    case 3: cfg.flash = v ? 1 : 0; break;
    case 4: cfg.attract = v ? 1 : 0; break;
    case 5: cfg.hintPulseMs = v; break;
    case 6: cfg.rippleMs = v; break;
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

void clearAll() {
  for (auto &k : keys) k = Key();
  for (auto &r : ripples) r.on = false;
  memset(rawLeds, 0, sizeof(rawLeds));
  if (anyRaw) { anyRaw = false; updateActiveLeds(); }
}

void startRipple(uint8_t note, CRGB color) {
  if (!cfg.rippleMs) return;
  float sum = 0;
  int n = 0;
  forEachLed(note, [&](int i) { sum += i; n++; });
  if (!n) return;
  ripples[nextRipple] = {sum / n, color, millis(), true};
  nextRipple = (nextRipple + 1) % MAX_RIPPLES;
}

// Runs one complete message. buf[0] is the status byte.
void runMessage(const uint8_t *m) {
  switch (m[0]) {
    case 0x90: {
      Key &k = keys[m[1]];
      k.color = CRGB(scale7(m[2]), scale7(m[3]), scale7(m[4]));
      k.level = 1.0f;
      k.held = true;
      k.flash = cfg.flash ? 1.0f : 0.0f;
      startRipple(m[1], k.color);
      break;
    }
    case 0x80: keys[m[1]].held = false; if (cfg.fadeMs == 0) keys[m[1]].level = 0; break;
    case 0xA0: keys[m[1]].hint = CRGB(scale7(m[2]), scale7(m[3]), scale7(m[4])); break;
    case 0xB0: setParam(m[1], m[2] | (m[3] << 7)); break;
    case 0xC0: {
      int i = m[1] | (m[2] << 7);
      if (i < NUM_LEDS) {
        rawLeds[i] = CRGB(scale7(m[3]), scale7(m[4]), scale7(m[5]));
        if (!anyRaw) { anyRaw = true; updateActiveLeds(); }
      }
      break;
    }
    case 0xF0: clearAll(); break;
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
    if (attractOn) { attractOn = false; dirty = true; }
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
bool stepAnimations(float dtMs) {
  bool animating = false;
  if (cfg.hintPulseMs) for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) if (keys[n].hint) { animating = true; break; }
  for (auto &k : keys) {
    if (k.flash > 0) { k.flash = max(0.0f, k.flash - dtMs / FLASH_MS); animating = true; }
    if (!k.held && k.level > 0) {
      k.level = cfg.fadeMs ? max(0.0f, k.level - dtMs / cfg.fadeMs) : 0.0f;
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
    if (age >= cfg.rippleMs) { r.on = false; continue; }
    float u = (float)age / cfg.rippleMs, amp = 0.55f * (1 - u) * (1 - u);
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

void renderKeys(uint32_t now) {
  // Hint breathing: 35% to 100%, so a hint never disappears between pulses.
  uint8_t pulse = 255;
  if (cfg.hintPulseMs) pulse = 90 + scale8(sin8((uint32_t)(now % cfg.hintPulseMs) * 256 / cfg.hintPulseMs), 165);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  renderRipples(now);  // under the keys: a lit key's own color wins on its LEDs
  for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) {
    Key &k = keys[n];
    CRGB c = CRGB::Black;
    if (k.level > 0) {
      c = k.color;
      if (k.flash > 0) c = blend(c, CRGB::White, (uint8_t)(k.flash * 200));
      c.nscale8_video((uint8_t)(k.level * 255));
    } else if (k.hint) {
      c = k.hint;  // the key layer wins over the hint while a key is lit
      c.nscale8_video(pulse);
    }
    if (!c) continue;
    forEachLed(n, [&](int i) { leds[i] |= c; });  // overlapping keys: brightest channel wins
  }
  if (anyRaw) for (int i = 0; i < NUM_LEDS; i++) leds[i] |= rawLeds[i];
}

void renderAttract(uint32_t now) {
  // Slow rainbow over the LEDs in use, dim enough to sit on all night.
  uint8_t hue = now / 40;
  for (int i = 0; i < activeLeds; i++) leds[i] = CHSV(hue + i * 2, 255, 40);
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

void setup() {
  Serial.setRxBufferSize(1024);
  Serial.begin(SERIAL_BAUD);
  loadSettings();
  FastLED.addLeds<WS2812B, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, MAX_MILLIAMPS);
  FastLED.setBrightness(cfg.brightness);
  FastLED.setDither(0);  // dithering flickers at low levels on 144/m strips
  bootTest();
  updateActiveLeds();
  lastByteAt = millis();
  // Opening the port from Chrome resets the board (DTR/RTS auto-reset), so the
  // browser should wait for this line before sending anything.
  printHello();
}

void loop() {
  readSerial();
  uint32_t now = millis();

  // Chrome has stalled before (minutes without MIDI). Don't leave keys stuck on.
  if (!watchdogFired && now - lastByteAt > WATCHDOG_MS) {
    for (auto &k : keys) k.held = false;
    watchdogFired = true;
    dirty = true;
  }
  if (cfg.attract && !attractOn && now - lastByteAt > ATTRACT_MS) {
    clearAll();
    attractOn = true;
  }

  // New input jumps the queue: it waits at most INPUT_FRAME_MS, not a whole animation frame.
  if (now - lastFrameAt < (dirty ? INPUT_FRAME_MS : FRAME_MS)) return;
  float dt = now - lastFrameAt;
  lastFrameAt = now;

  if (attractOn) {
    renderAttract(now);
    show();
    return;
  }
  bool animating = stepAnimations(dt);
  if (dirty || animating) {
    renderKeys(now);
    show();
    dirty = false;
  }
}
