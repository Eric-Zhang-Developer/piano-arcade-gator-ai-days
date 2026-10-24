#pragma once
#include <cstring>
#include <cstddef>
struct Preferences {
  static unsigned char store[256]; static size_t len;
  bool begin(const char*, bool) { return true; } void end() {}
  size_t getBytesLength(const char*) { return len; }
  size_t getBytes(const char*, void* p, size_t n) { memcpy(p, store, n); return n; }
  size_t putBytes(const char*, const void* p, size_t n) { memcpy(store, p, n); len = n; return n; }
};
unsigned char Preferences::store[256]; size_t Preferences::len = 0;
