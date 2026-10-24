# Layer 1: macOS

Audio MIDI Setup (`/Applications/Utilities`), then Window > Show MIDI Studio.

- **IAC Driver** (virtual loopback, for testing without the piano): double-click "IAC Driver", tick "Device is
  online". Its port is "IAC Driver Bus 1": what you send to it comes back on its input.
- **The piano:** plug the USB TO HOST port into the Mac, no hub. It should appear as its own device in MIDI Studio.
  Its name and port count, as shown: see [RESULTS.md](RESULTS.md) (R1).
