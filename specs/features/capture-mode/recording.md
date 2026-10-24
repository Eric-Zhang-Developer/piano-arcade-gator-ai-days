# Recording the video

How to record Piano Arcade clean: no cursor, no setup text, nothing from the computer. Each step works on `main` as of
capture-mode's done note (2026-10-24).

## 1. Build and start
From the repo root:

```bash
pnpm -C web build && pnpm -C web start
```

`next start` serves on `http://localhost:3000`. Record the production build, not `pnpm dev`: dev mode adds Next's
dev-tools badge in the bottom-left corner and compiles pages on first visit.

## 2. Set up once, before turning capture on
These are remembered in the browser, so do them in the Chrome profile you'll record with.

- **Calibrate latency:** open `http://localhost:3000/calibrate` and tap along. Capture mode hides the Calibrate link
  and the latency slider, so do this first.
- **Labels:** on `/play`'s start screen, press the Labels button until it reads **Labels: Note names** (one press
  from Auto) or **Labels: Off** (three presses). It's remembered. Left on **Auto**, notes show laptop letters until
  the first piano note after each page load.
- **The piano:** connect the DGX by USB before pressing Start; `/play` looks for it then, and its status line (hidden
  under capture) says what it found. Check it once without capture.

## 3. The browser
- Chrome, with the page at **1920×1080**: full screen (View → Enter Full Screen, or Ctrl+Cmd+F) on a 1080p display,
  or a window sized so the page itself is 1920×1080.
- Chrome's own UI out of the frame: in full screen, untick View → **Always Show Toolbar in Full Screen** (Shift+Cmd+F),
  so the tabs, the address bar, the bookmarks bar and extension icons are hidden.
- One tab for the take, so capture's setting (kept per tab) is the one you turned on.

## 4. What the computer adds
- **Notifications:** turn on Do Not Disturb (Control Center → Focus).
- **The Dock and menu bar:** full screen hides both, but the menu bar slides back in when the pointer touches the top
  edge (capture hides the pointer, not its position): park the mouse mid-screen. In a window, set the Dock to hide
  automatically (System Settings → Desktop & Dock).
- Close other apps that pop up dialogs or sounds.

## 5. Turn capture on and record
1. Open `http://localhost:3000/?capture=1`. The flag is kept for this tab, so the song select's links into `/play`
   keep it on. It works on any page: `/play?song=twinkle&capture=1` does the same.
2. **Wait until the page has loaded before you start recording.** The flag applies once the page is running (there's
   no script in `<head>`), so the first frames of a load can still show the cursor or setup text.
3. Record with your screen recorder.

What capture hides:
- the cursor;
- the MIDI status line, the laptop-keys hint, the latency slider and the effects controls on `/play`;
- the timing panel's "Set latency offset" suggestion on the results;
- the Calibrate latency link on `/`;
- beat-track's "Beat: …" corner text (the beat still plays).

Everything that's the game stays: the song cards, the stage card, the start panels (Labels, Learn it first), the HUD,
judgments, the results and their panels, and the pause menu.

## 6. Turn it off
Open any page with `?capture=0` (or open a new tab: the setting is per tab).
