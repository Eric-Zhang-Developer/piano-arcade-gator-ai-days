# led-strip: two light modes, quiet by default

- Date: 2026-10-25   Decided by: sharan-1   Feature: led-strip
- **Context:** Open PR #720 (`led-hint-ramp`) replaces the strip's look with one show (hint build-up, wrong-key red, count-in bar, fever, pause rainbow, finale, idle aurora) and turns ripples off. Main's look is key light plus a ripple. Both have to stay, and the one that lands on main has to be the quieter one until someone asks for the show.
- **Options:** A) merge #720 as the only look / B) one setting that switches, quiet by default, full = #720's show / C) leave #720's knobs (settings 6–9) and no single switch.
- **Choice:** B. Setting 15 (`0xB0`) writes the preset. Quiet is the compiled default, so a save from current main stays quiet. The switch lives on `firmware/tester.html` and `firmware/playground.html`, which this lane owns. The game menu is Eric's folder, so it is a `needs-human` issue instead of a game edit.
- **How to undo:** delete setting 15 and ship one preset as the compiled defaults.
