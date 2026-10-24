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

int main() {
  setup();
  CHECK(Serial.out.find("PAL1 leds=288") == 0, "hello line: %s", Serial.out.c_str());

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
    litFor(21)[0], litFor(21)[1], litFor(60)[0], litFor(60)[1], litFor(108)[0], litFor(108)[1], minGap, maxGap);
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
  Serial.feed({0xB0, 21, 0, 0}); pump(5); CHECK(cfg.reverse == 0 && cfg.calLow == 4.0f, "defaults");
  CHECK(litFor(60).size() == 2, "C4 has 2");

  // Joint gap of 2 LEDs: keys after LED 144 shift, nobody lands on the joint, still no overlaps.
  Serial.feed({0xB0, 13, 32, 0}); pump(5);
  prevLast = -1;
  for (int n = LOW_NOTE; n <= HIGH_NOTE; n++) { auto v = litFor(n);
    CHECK(!v.empty(), "note %d dark with gap", n); if (v.empty()) continue;
    CHECK(v.front() >= prevLast, "out of order at %d with gap", n); prevLast = v.back(); }
  std::printf("with 2-LED joint gap: C8 -> %d\n", litFor(108).back()); CHECK(litFor(108).back() >= 173 && litFor(108).back() <= 175, "gap shifts C8 back 2");
  for (int i = 0; i < NUM_LEDS; i++) { int owners = 0; for (int n = 21; n <= 108; n++) for (int j : litFor(n)) owners += j == i; CHECK(owners <= (i == 144 || i == 143 ? 2 : 1), "LED %d shared", i); }
  Serial.feed({0xB0, 21, 0, 0}); pump(5);

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
  Serial.feed({0xB0, 21, 0, 0}); pump(5); CHECK(activeLeds < NUM_LEDS, "defaults trim again");

  // Hints breathe between ~35% and 100%, and never go dark.
  Serial.feed({0xA0, 60, 0, 0, 127}); pump(5);
  int lo = 255, hi = 0;
  for (int t = 0; t < 120; t++) { pump(10); int b = leds[litFor(60)[0]].b; lo = min(lo, b); hi = max(hi, b); }
  std::printf("hint pulse range: %d..%d\n", lo, hi);
  CHECK(lo >= 70 && lo <= 110 && hi >= 230, "pulse range %d..%d", lo, hi);
  Serial.feed({0xB0, 5, 0, 0}); pump(30);
  CHECK(leds[litFor(60)[0]].b >= 250, "steady hint when pulse off");
  Serial.feed({0xF0, 0xB0, 21, 0, 0}); pump(5);

  std::printf(fails ? "%d FAILED\n" : "all checks passed\n", fails);
  return fails != 0;
}
