#include <FastLED.h>
#include <deque>
#include <vector>
#include <string>
#include <cstdio>
#include <cstdarg>
#include <cassert>
#include <algorithm>
using std::min; using std::max;
struct FakeSerial {
  std::deque<uint8_t> in; std::string out;
  void setRxBufferSize(int) {} void begin(int) {}
  int available() { return in.size(); }
  int read() { int b = in.front(); in.pop_front(); return b; }
  void printf(const char* f, ...) { char b[512]; va_list a; va_start(a, f); vsnprintf(b, 512, f, a); va_end(a); out += b; }
  void println(const char* s) { out += s; out += "\n"; }
  void feed(std::initializer_list<int> bs) { for (int b : bs) in.push_back(b); }
} Serial;
#include "Preferences.h"
#include "../piano_leds/piano_leds.ino"

static int fails = 0;
#define CHECK(c, ...) do { if (!(c)) { fails++; std::printf("FAIL %s:%d ", __FILE__, __LINE__); std::printf(__VA_ARGS__); std::printf("\n"); } } while (0)
std::vector<int> litFor(uint8_t n) { std::vector<int> v; forEachLed(n, [&](int i) { v.push_back(i); }); return v; }
int countLit() { int c = 0; for (int i = 0; i < NUM_LEDS; i++) if (leds[i]) c++; return c; }
void pump(int ms) { uint32_t end = millis() + ms; do { loop(); } while (millis() < end); }
// Compiled defaults, but with ripples, shows and idle lights off: most checks below count exactly the LEDs under a key.
void defaults() { Serial.feed({0xB0, 21, 0, 0, 0xB0, 6, 0, 0, 0xB0, 9, 0, 0, 0xB0, 4, 0, 0}); }  // shows, idle off

int main() {
  setup();
  CHECK(Serial.out.find("PAL1 leds=288") == 0, "hello line: %s", Serial.out.c_str());
  CHECK(Serial.out.find("ripple=700 ") != std::string::npos, "quiet: ripple on by default");
  CHECK(Serial.out.find("wrong=0") != std::string::npos, "quiet: wrong keys off by default");
  CHECK(Serial.out.find("shows=0") != std::string::npos, "quiet: shows off by default");
  CHECK(Serial.out.find("ramp=0") != std::string::npos, "quiet: hint ramp off by default");
  CHECK(Serial.out.find("light=0") != std::string::npos, "quiet mode by default");
  defaults(); pump(5);

  // Geometry: every key 2 LEDs, positions strictly increasing, no two keys share an LED.
  int prevLast = -1, minGap = 99, maxGap = 0, ones = 0;
  for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) {
    auto v = litFor(n);
    CHECK(v.size() >= 1 && v.size() <= 2, "note %d lit %zu", n, v.size()); ones += v.size() == 1;
    if (v.empty()) continue;
    CHECK(v.front() > prevLast, "note %d overlaps previous (%d <= %d)", n, v.front(), prevLast);
    if (prevLast >= 0) { minGap = min(minGap, v.front() - prevLast); maxGap = max(maxGap, v.front() - prevLast); }
    prevLast = v.back();
  }
  std::printf("keys with 1 LED: %d\n", ones);
  std::printf("A0 -> %d,%d  C4 -> %d,%d  C8 -> %d,%d  gaps between keys %d..%d LEDs\n",
    litFor(21).front(), litFor(21).back(), litFor(60).front(), litFor(60).back(), litFor(108).front(), litFor(108).back(),
    minGap, maxGap);  // front/back: a key can have just 1 LED (A0 does)
  CHECK(litFor(21)[0] >= 3 && litFor(21)[0] <= 4, "A0"); CHECK(maxGap == 1, "contiguous slots"); CHECK(ones <= 3, "few 1-LED keys");
  CHECK(litFor(108).back() >= 175 && litFor(108).back() <= 177, "C8");
  CHECK(litFor(20).empty() && litFor(109).empty(), "out of range notes light nothing");

  // Protocol: key on lights exactly that key, in GRB-agnostic RGB terms.
  Serial.feed({0x90, 60, 127, 0, 0}); pump(20);
  CHECK(countLit() == (int)litFor(60).size(), "key on lit %d", countLit());
  CHECK(leds[litFor(60)[0]].r > leds[litFor(60)[0]].g, "red-ish (flash blends white)");
  pump(150);  // flash done
  CRGB c = leds[litFor(60)[0]];
  CHECK(c.r > 200 && c.g == 0 && c.b == 0, "steady red after flash: %d %d %d", c.r, c.g, c.b);
  // Key off fades, then dark.
  Serial.feed({0x80, 60}); pump(60);
  CHECK(leds[litFor(60)[0]].r > 0 && leds[litFor(60)[0]].r < c.r, "fading: %d", leds[litFor(60)[0]].r);
  pump(250); CHECK(countLit() == 0, "dark after fade: %d", countLit());

  // Resync: a truncated message followed by a good one.
  Serial.feed({0x90, 61, 10, 0x90, 62, 0, 127, 0}); pump(150);
  CHECK(countLit() == (int)litFor(62).size() && leds[litFor(62)[0]].g > 200, "resync to note 62");
  Serial.feed({0xF0}); pump(10); CHECK(countLit() == 0, "clear");

  // Hint layer, then key layer wins over it.
  Serial.feed({0xA0, 64, 0, 0, 100}); pump(10);
  CHECK(leds[litFor(64)[0]].b > 0 && countLit() == (int)litFor(64).size(), "hint shows");
  Serial.feed({0x90, 64, 0, 127, 0}); pump(150);
  CHECK(leds[litFor(64)[0]].g > 200 && leds[litFor(64)[0]].b == 0, "key beats hint");
  Serial.feed({0x80, 64}); pump(300);
  CHECK(leds[litFor(64)[0]].b > 0, "hint returns after release");
  Serial.feed({0xA0, 64, 0, 0, 0, 0xF0}); pump(10);

  // Settings: 14-bit calLow = 10.0 (160 = 0x20 | 1<<7), reverse, save/load.
  Serial.out.clear();
  Serial.feed({0xB0, 10, 160 & 127, 160 >> 7}); pump(5);
  CHECK(Serial.out.find("calLow=10.00") != std::string::npos, "%s", Serial.out.c_str());
  CHECK(litFor(21)[0] >= 9 && litFor(21)[0] <= 10, "A0 moved: %d", litFor(21)[0]);
  Serial.feed({0xB0, 14, 1, 0}); pump(5);
  CHECK(litFor(21)[0] >= NUM_LEDS - 12 && litFor(21)[0] <= NUM_LEDS - 10, "reversed A0 near the far end: %d", litFor(21)[0]);
  Serial.feed({0xB0, 20, 0, 0}); pump(5);
  CHECK(Serial.out.find("saved") != std::string::npos, "saved");
  cfg = Settings(); loadSettings(); CHECK(cfg.reverse == 1 && cfg.calLow == 10.0f, "reload");
  defaults(); pump(5); CHECK(cfg.reverse == 0 && cfg.calLow == 4.0f, "defaults");
  CHECK(litFor(60).size() == 2, "C4 has 2");

  // Joint gap of 2 LEDs: keys after LED 144 shift, nobody lands on the joint, still no overlaps.
  Serial.feed({0xB0, 13, 32, 0}); pump(5);
  prevLast = -1;
  for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) { auto v = litFor(n);
    CHECK(!v.empty(), "note %d dark with gap", n); if (v.empty()) continue;
    CHECK(v.front() >= prevLast, "out of order at %d with gap", n); prevLast = v.back(); }
  std::printf("with 2-LED joint gap: C8 -> %d\n", litFor(108).back()); CHECK(litFor(108).back() >= 173 && litFor(108).back() <= 175, "gap shifts C8 back 2");
  for (int i = 0; i < NUM_LEDS; i++) { int owners = 0; for (int n = 21; n <= 108; n++) for (int j : litFor(n)) owners += j == i; CHECK(owners <= (i == 144 || i == 143 ? 2 : 1), "LED %d shared", i); }
  defaults(); pump(5);

  // Raw test LED.
  Serial.feed({0xC0, 287 & 127, 287 >> 7, 0, 127, 0}); pump(10);
  CHECK(leds[287].g > 200, "raw last LED");
  Serial.feed({0xF0}); pump(10);

  // Watchdog: a held key with no traffic gets released.
  Serial.feed({0x90, 70, 127, 127, 127}); pump(200);
  CHECK(countLit() == (int)litFor(70).size(), "held");
  pump(WATCHDOG_MS + 400);
  CHECK(countLit() == 0, "watchdog released stuck key: %d", countLit());

  // Ping answers at once with the frame cost and LED count.
  Serial.out.clear(); Serial.feed({0xF2, 42}); pump(5);
  CHECK(Serial.out.find("PONG 42 ") == 0, "pong: %s", Serial.out.c_str());

  // Only the LEDs under the keys are driven; a raw test widens it to the full strip and back.
  CHECK(activeLeds >= 175 && activeLeds <= 178, "active %d", activeLeds);
  CHECK(FastLED[0].size() == activeLeds, "controller size %d", FastLED[0].size());
  Serial.feed({0xC0, 287 & 127, 287 >> 7, 0, 127, 0}); pump(10);
  CHECK(activeLeds == NUM_LEDS && FastLED[0].size() == NUM_LEDS, "raw widens");
  Serial.feed({0xF0}); pump(10);
  CHECK(activeLeds < NUM_LEDS && leds[287] == CRGB(0, 0, 0), "clear shrinks and blanks the tail");
  Serial.feed({0xB0, 14, 1, 0}); pump(5); CHECK(activeLeds == NUM_LEDS, "reverse drives all");
  defaults(); pump(5); CHECK(activeLeds < NUM_LEDS, "defaults trim again");

  // Hints breathe between ~35% and 100%, and never go dark (ramp off, so only the breath shows).
  Serial.feed({0xB0, 7, 0, 0, 0xA0, 60, 0, 0, 127}); pump(5);
  int lo = 255, hi = 0;
  for (int t = 0; t < 120; t++) { pump(10); int b = leds[litFor(60)[0]].b; lo = min(lo, b); hi = max(hi, b); }
  std::printf("hint pulse range: %d..%d\n", lo, hi);
  CHECK(lo >= 70 && lo <= 110 && hi >= 230, "pulse range %d..%d", lo, hi);
  Serial.feed({0xB0, 5, 0, 0}); pump(30);
  CHECK(leds[litFor(60)[0]].b >= 250, "steady hint when pulse off");
  Serial.feed({0xF0}); defaults(); pump(5);

  // Hint ramp: a new hint starts nearly dark and brightens evenly as the eye sees it (duty = seen^2.2) to twice
  // the color the game sent by 600 ms, then breathes from its peak. Sent at 60 (120 on the LEDs) so 2x isn't clipped.
  Serial.feed({0xB0, 7, 600 & 127, 600 >> 7, 0xA0, 64, 0, 0, 60}); pump(20);
  int r20 = leds[litFor(64)[0]].b; pump(280);
  int r300 = leds[litFor(64)[0]].b; pump(150);
  int r450 = leds[litFor(64)[0]].b; pump(140);
  int r590 = leds[litFor(64)[0]].b; pump(40);
  int r630 = leds[litFor(64)[0]].b;
  int breathLo = 255;
  for (int t = 0; t < 100; t++) { pump(10); breathLo = min<int>(breathLo, leds[litFor(64)[0]].b); }
  std::printf("hint ramp (sent 120): %d @20ms, %d @300, %d @450, %d @590, %d @630, late breath down to %d\n",
              r20, r300, r450, r590, r630, breathLo);
  CHECK(r20 > 0 && r20 <= 12, "starts nearly dark: %d", r20);
  CHECK(r300 > r20 && r450 > r300 && r590 > r450, "keeps brightening: %d %d %d %d", r20, r300, r450, r590);
  CHECK(r300 >= 55 && r300 <= 90, "halfway in what the eye sees is ~30%% of the peak in duty: %d", r300);
  CHECK(r590 >= 220 && r630 >= 220, "about twice the sent color at the note, no dip after: %d %d", r590, r630);
  CHECK(breathLo >= 100 && breathLo <= 125, "a late hint keeps breathing bright: %d", breathLo);
  Serial.feed({0xA0, 64, 0, 0, 0, 0xA0, 64, 0, 0, 127}); pump(150);
  int restarted = leds[litFor(64)[0]].b;
  Serial.feed({0xA0, 64, 0, 127, 0}); pump(10);
  CHECK(leds[litFor(64)[0]].g > restarted / 2 && leds[litFor(64)[0]].b == 0, "recolor keeps the ramp: %d vs %d", leds[litFor(64)[0]].g, restarted);
  CHECK(restarted >= 35 && restarted <= 80, "off then on restarts the ramp: %d at 150 ms", restarted);
  Serial.feed({0xF0}); defaults(); pump(5);

  // Repeated note: the game keeps one hint lit across both notes. Hitting the key restarts the ramp, so the next
  // note's key is near full again when it lands, not wherever the breath happened to be.
  Serial.feed({0xB0, 7, 600 & 127, 600 >> 7, 0xA0, 65, 0, 0, 127}); pump(1300);  // ramp on; long-lit hint, breathing
  Serial.feed({0x90, 65, 0, 127, 0}); pump(100); Serial.feed({0x80, 65}); pump(250);  // hit, release, fade out
  int rep350 = leds[litFor(65)[0]].b; pump(240);
  int rep590 = leds[litFor(65)[0]].b;
  std::printf("repeated note: hint %d at 350 ms after the hit, %d at 590 ms\n", rep350, rep590);
  CHECK(rep350 < rep590 && rep590 >= 225, "ramp restarts at the hit: %d -> %d", rep350, rep590);
  Serial.feed({0xF0}); defaults(); pump(5);

  // Wrong key: the game sends a key off for every release but a key on only for judged notes. A release of a
  // key that never lit flashes red, holds, then fades. A hit's release doesn't, and setting 8 turns it off.
  Serial.feed({0xB0, 8, 1, 0, 0xA0, 40, 0, 0, 1, 0xA0, 40, 0, 0, 0});  // wrong-key red on; a hint has come: a song is live
  Serial.feed({0x80, 70}); pump(20);
  CRGB w = leds[litFor(70)[0]];
  CHECK(w.r > 200 && w.g == 0 && w.b == 0, "wrong key red: %d %d %d", w.r, w.g, w.b);
  pump(250); CHECK(leds[litFor(70)[0]].r > 200, "red holds: %d", leds[litFor(70)[0]].r);
  pump(400); CHECK(countLit() == 0, "red gone after hold + fade: %d", countLit());
  Serial.feed({0x90, 71, 127, 113, 61}); pump(50); Serial.feed({0x80, 71}); pump(20);
  CHECK(wrongFlashes == 1, "a hit's release isn't wrong: %u", wrongFlashes);
  pump(300);
  Serial.feed({0xB0, 8, 0, 0, 0x80, 72}); pump(20);
  CHECK(wrongFlashes == 1 && countLit() == 0, "setting 8 off: no red (%u, %d lit)", wrongFlashes, countLit());
  Serial.feed({0xF0}); defaults(); pump(5);

  // Shows. A clear with no song live starts the count-in show; the first hint launches from its key and the
  // strip settles to just that hint; a clear while a song is live plays the fireworks, which end dark.
  // A wrong-key release during the count-in isn't red, and a key on stops a count-in show (the tester).
  uint32_t wrongBefore = wrongFlashes;
  Serial.feed({0xB0, 9, 1, 0, 0xF0}); pump(1000);
  int introLit = countLit();
  Serial.feed({0x80, 70}); pump(20);
  CHECK(wrongFlashes == wrongBefore, "no red during the count-in");
  pump(2500);
  int introLate = countLit();
  Serial.feed({0xA0, 60, 0, 40, 127}); pump(40);
  int launchLit = countLit();
  pump(1800);
  std::printf("shows: count-in %d LEDs lit at 1 s, %d at 3.5 s; launch %d; after it %d (hint is %zu)\n",
              introLit, introLate, launchLit, countLit(), litFor(60).size());
  CHECK(introLit >= 3 && introLate > introLit, "count-in builds: %d -> %d", introLit, introLate);
  CHECK(launchLit > (int)litFor(60).size() + 4, "launch bursts from the first key: %d", launchLit);
  CHECK(countLit() == (int)litFor(60).size() && showMode == SHOW_NONE, "then only the hint: %d", countLit());
  CHECK(introExpectMs >= 3450 && introExpectMs <= 3700, "the bar learned this count-in's length: %u ms", introExpectMs);
  Serial.feed({0xF0}); pump(800);
  int finaleLit = countLit();
  pump(5000);
  std::printf("shows: fireworks %d LEDs lit at 0.8 s, %d after\n", finaleLit, countLit());
  CHECK(finaleLit >= 10 && showMode == SHOW_NONE && countLit() == 0, "fireworks, then dark: %d, %d", finaleLit, countLit());
  Serial.feed({0xF0, 0x90, 62, 0, 127, 0}); pump(1800);
  CHECK(showMode == SHOW_NONE && countLit() == (int)litFor(62).size(), "a key on stops a count-in show: %d", countLit());
  Serial.feed({0xF0}); defaults(); pump(5); stopShows();

  // Fever, mirrored from the hit colors: 12 PERFECTs fill Twinkle's gauge and start it (a glow under the keys);
  // a miss shatters it. Before fever a miss halves the gauge and GREAT adds half a point. A song's end sizes the
  // next gauge from its judged notes (a quarter, 12 to 50).
  Serial.feed({0xB0, 9, 1, 0, 0xA0, 40, 0, 0, 1, 0xA0, 40, 0, 0, 0});  // shows on, a song is live
  for (int i = 0; i < 4; i++) { Serial.feed({0x90, 60, 127, 113, 61, 0x80, 60}); pump(30); }
  Serial.feed({0x90, 62, 127, 38, 47, 0x80, 62}); pump(30);
  CHECK(!fever && gaugeFill == 2.0f, "a miss before fever halves the gauge: %.1f", gaugeFill);
  Serial.feed({0x90, 64, 47, 121, 98, 0x80, 64}); pump(30);
  CHECK(gaugeFill == 2.5f, "GREAT adds half a point: %.1f", gaugeFill);
  for (int i = 0; i < 10; i++) { Serial.feed({0x90, 60, 127, 113, 61, 0x80, 60}); pump(30); }
  pump(500);
  int feverLit = countLit();
  CHECK(fever && feverLit > 100, "fever: the gauge fills and the glow comes up: %d lit", feverLit);
  Serial.feed({0x90, 65, 127, 38, 47}); pump(20);
  CHECK(!fever && gaugeFill == 0, "a miss in fever breaks it and empties the gauge");
  pump(1200);
  std::printf("fever: %d LEDs glowing; after the break %d (the miss key %zu)\n", feverLit, countLit(), litFor(65).size());
  CHECK(countLit() <= (int)litFor(65).size(), "the glow is gone after the break: %d", countLit());
  Serial.feed({0x80, 65, 0xF0}); pump(5);
  CHECK(gaugeSize == 12, "17 judged notes keeps the 12 minimum: %u", gaugeSize);
  Serial.feed({0xA0, 40, 0, 0, 1});
  for (int i = 0; i < 100; i++) Serial.feed({0x90, 61, 62, 91, 127, 0x80, 61});
  pump(50); Serial.feed({0xF0}); pump(5);
  CHECK(gaugeSize == 25, "100 judged notes: a 25-point gauge next time: %u", gaugeSize);
  Serial.feed({0xF0}); defaults(); pump(5); stopShows();

  // Pause: during a song, notes keep messages coming, so no pause show; 2 s of only heartbeats starts it (the
  // paused hint stays on top), and the next message of any other kind ends it at once.
  Serial.feed({0xB0, 9, 1, 0, 0xA0, 60, 0, 0, 60});  // shows on, a hint: a song is live
  // Green, not a judgment color: the fever gauge stays empty, so no embers sparkle into the counts below.
  for (int i = 0; i < 8; i++) { Serial.feed({0xFE, 0x90, 50, 0, 127, 0}); pump(250); Serial.feed({0x80, 50}); pump(250); }
  CHECK(pauseShows == 0, "notes every 500 ms: no pause show (%u)", pauseShows);
  for (int i = 0; i < 3; i++) { Serial.feed({0xFE}); pump(800); }
  int pauseLit = countLit();
  CHECK(showMode == SHOW_PAUSE && pauseShows == 1 && pauseLit > 100, "2 s of heartbeats: pause show, %d lit", pauseLit);
  CHECK(leds[litFor(60)[0]].b > 60, "the paused hint still shows: %d", leds[litFor(60)[0]].b);
  Serial.feed({0x90, 60, 0, 127, 0}); pump(20);
  CHECK(showMode == SHOW_NONE, "the next message ends the pause show");
  pump(1200);
  std::printf("pause: %d LEDs lit in the pause show; after resuming %d\n", pauseLit, countLit());
  CHECK(countLit() == (int)litFor(60).size(), "after resuming only the key: %d", countLit());
  Serial.feed({0x80, 60, 0xF0}); pump(5); Serial.feed({0xF0}); defaults(); pump(5); stopShows();

  // Idle lights: 8 s of nothing but heartbeats with no song live, and the aurora comes up; a key released then
  // sparkles without ending it; any play message ends it at once.
  Serial.feed({0xB0, 15, 1, 0}); pump(5);  // full mode: aurora idle, ripples off
  for (int i = 0; i < 9; i++) { Serial.feed({0xFE}); pump(1000); }
  int idleLit = countLit();
  CHECK(attractOn && idleLit > 100, "idle lights after 8 s of heartbeats: %d lit", idleLit);
  Serial.feed({0x80, 60}); pump(30);
  CHECK(attractOn, "a key touched while idle sparkles and stays idle");
  Serial.feed({0x90, 62, 0, 127, 0}); pump(20);
  std::printf("idle: %d LEDs lit after 9 s; a key on ends it -> %d lit\n", idleLit, countLit());
  CHECK(!attractOn && countLit() == (int)litFor(62).size(), "play ends idle: %d lit", countLit());
  Serial.feed({0xF0}); defaults(); pump(5);

  // Quiet idle stays the dim rainbow from main. Heartbeats count as bytes, so 9 s of them
  // leave the strip dark. 15 s with nothing at all is the rainbow, and the next byte ends it.
  Serial.feed({0xB0, 15, 0, 0}); pump(5);
  for (int i = 0; i < 9; i++) { Serial.feed({0xFE}); pump(1000); }
  CHECK(!attractOn && countLit() == 0, "quiet: heartbeats do not start idle lights (%d lit)", countLit());
  pump(16000);
  CHECK(attractOn && countLit() > 100, "quiet: 15 s of silence is the dim rainbow (%d lit)", countLit());
  CHECK(leds[0].r <= 50 && leds[0].g <= 50 && leds[0].b <= 50, "rainbow stays dim: %d %d %d", leds[0].r, leds[0].g, leds[0].b);
  Serial.feed({0xFE}); pump(30);
  CHECK(!attractOn, "quiet: a heartbeat ends the rainbow");
  defaults(); pump(5);

  // Setting 15 switches the two looks. Full starts the count-in on a clear and turns ripples off.
  // Quiet stops that show, brings the ripple back, and a clear stays dark.
  Serial.out.clear();
  Serial.feed({0xB0, 15, 1, 0}); pump(20);
  CHECK(cfg.lightMode == 1 && cfg.rippleMs == 0 && cfg.hintRampMs == 600 && cfg.wrongRed == 1 && cfg.shows == 1,
        "full preset: mode %u ripple %u ramp %u wrong %u shows %u", cfg.lightMode, cfg.rippleMs, cfg.hintRampMs, cfg.wrongRed, cfg.shows);
  CHECK(Serial.out.find("light=1") != std::string::npos, "hello echoes full: %s", Serial.out.c_str());
  Serial.feed({0xF0}); pump(1000);
  CHECK(showMode == SHOW_INTRO && countLit() >= 3, "full: a clear starts the count-in (%d lit)", countLit());
  Serial.feed({0xB0, 15, 0, 0}); pump(20);
  CHECK(cfg.lightMode == 0 && cfg.rippleMs == 700 && cfg.hintRampMs == 0 && cfg.wrongRed == 0 && cfg.shows == 0,
        "quiet preset: mode %u ripple %u ramp %u wrong %u shows %u", cfg.lightMode, cfg.rippleMs, cfg.hintRampMs, cfg.wrongRed, cfg.shows);
  CHECK(showMode == SHOW_NONE, "quiet stops a show that was running");
  Serial.feed({0xF0}); pump(400);
  CHECK(showMode == SHOW_NONE && countLit() == 0, "quiet: a clear does not start the count-in (%d lit)", countLit());
  Serial.feed({0x90, 60, 0, 0, 127}); pump(150);
  {
    float mid = (litFor(60).front() + litFor(60).back()) / 2.0f;
    int left = 0, right = 0;
    for (int i = 0; i < NUM_LEDS; i++) if (leds[i]) {
      float d = i - mid;
      if (d < -4) left++; if (d > 4) right++;
    }
    CHECK(left >= 2 && right >= 2, "quiet: a key on ripples both ways (%d left, %d right)", left, right);
  }
  Serial.feed({0xF0}); defaults(); pump(5);

  // A save from firmware that didn't have light mode yet (one uint16 shorter) still loads its calibration.
  // Boot default-initializes cfg first, so the missing byte stays quiet.
  Serial.feed({0xB0, 10, 160 & 127, 160 >> 7, 0xB0, 20, 0, 0}); pump(5);
  Preferences::len = sizeof(Settings) - sizeof(uint16_t);
  cfg = Settings(); cfg.hintRampMs = 1; loadSettings();
  CHECK(cfg.calLow == 10.0f, "old save keeps calibration: %.2f", cfg.calLow);
  CHECK(cfg.lightMode == 0, "a save without the light-mode byte stays quiet");
  CHECK(cfg.hintRampMs == 0, "the saved quiet ramp overwrites a dirty value: %u", cfg.hintRampMs);
  Preferences::len = 0; defaults(); pump(5);

  // Ripple: a key on sends light out both ways, the key keeps its own color, and it all clears.
  Serial.feed({0xB0, 6, 700 & 127, 700 >> 7}); pump(5);
  Serial.feed({0x90, 60, 0, 0, 127}); pump(150);
  float mid = (litFor(60).front() + litFor(60).back()) / 2.0f;
  int left = 0, right = 0, far = 0;
  for (int i = 0; i < NUM_LEDS; i++) if (leds[i]) {
    float d = i - mid;
    if (d < -4) left++; if (d > 4) right++; if (fabsf(d) > 40) far++;
  }
  std::printf("ripple at 150 ms: %d LEDs left, %d right, %d past 40\n", left, right, far);
  CHECK(left >= 2 && right >= 2 && far == 0, "ripple spreads both ways: %d %d %d", left, right, far);
  CHECK(leds[litFor(60)[0]].b > 200 && leds[litFor(60)[0]].r < 60, "key keeps its color under the ripple");
  CHECK(leds[(int)mid + 13].b < leds[litFor(60)[0]].b, "ripple dimmer than the key");
  pump(700);
  CHECK(countLit() == (int)litFor(60).size(), "ripple gone, held key stays: %d", countLit());
  Serial.feed({0x80, 60, 0xB0, 6, 0, 0, 0x90, 62, 0, 127, 0}); pump(300);  // past key 60's fade
  CHECK(countLit() == (int)litFor(62).size(), "ripple off: only the key: %d", countLit());
  Serial.feed({0xF0}); defaults(); pump(5);

  std::printf(fails ? "%d FAILED\n" : "all checks passed\n", fails);
  return fails != 0;
}
