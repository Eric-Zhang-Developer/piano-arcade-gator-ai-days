#!/usr/bin/env bash
# Builds the sketch for the laptop against FastLED's stub platform and checks the key
# mapping, protocol, fades, settings and watchdog. No board needed.
#   ./firmware/hosttest/run.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d .fastled ] || git clone -q --depth 1 --branch 3.9.4 https://github.com/FastLED/FastLED.git .fastled
FL=.fastled/src
g++ -std=gnu++17 -O1 -DFASTLED_STUB_IMPL -I. -I$FL -w test.cpp \
  $(find $FL -name '*.cpp' -not -path '*/platforms/*' -not -path '*third_party*') $FL/platforms/stub/*.cpp -o .test
./.test
