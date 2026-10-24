---
name: "Spike: can an iPad on the same wifi follow the sheet window?"
depends_on: ["sheet-view"]
owns: ["spikes/ipad-relay/"]
assignee: "eric"
---

# iPad relay spike

A side quest Eric asked for (2026-10-24). `/sheet` follows /play over the BroadcastChannel `pianoArcade.sheet`, which
stays inside one browser (`changes/sheet-view.md`, Gaps), so an iPad on the music rest can't show it. One question:
**can a tiny relay on the laptop get the sheet's messages to an iPad on the same wifi, quickly and without losing any?**
Only in `spikes/ipad-relay/`, never `web/`, never on the demo's path. Time box ~2 hours of agent time; the rest: a Gap.

Issue: #338

## Plan
1. **Relay:** `relay.mjs`, one Node process on the laptop bound to `0.0.0.0`, serves the two pages over HTTP and relays
   the sender's messages to every subscriber. Node ships a WebSocket client but no server, so use `ws`, pinned to an
   exact version in the spike's own `package.json` (`node_modules/` not committed). If `ws` gets in the way, the stdlib
   route is Server-Sent Events down (`node:http`) and `fetch` POSTs up. Record which one ran.
2. **Sender** (`send.html`, Chrome on the laptop): BroadcastChannel is same-origin and the spike can't change `web/`,
   so it can't hear /play. It replays the shapes in `web/src/game/sheet-view/plugin.tsx` instead: one `take` with a
   real chart read from `web/public/songs/`, a `clock` every animation frame, a `judgment` at each note's time, then
   `end`. Each message carries a sequence number.
3. **Subscriber** (`follow.html`, Safari on the iPad): counts messages, shows the latest clock and a bar that moves
   with it, and echoes each `clock`'s sequence number straight back through the relay.
4. Write `spikes/ipad-relay/FINDINGS.md` with the numbers and the recommendation.

## Requirements
- **Delay:** the two devices' clocks can't be compared, so the sender times each echoed `clock`'s round trip; one-way
  is half of it. Median, p95 and max of both, over the whole run.
- **Drops:** the subscriber logs sequence gaps; the sender counts unanswered echoes. Report sent and received counts
  per message type, and the `take` message's size in bytes.
- **Five minutes** unbroken, iPad awake with Safari in front. Then a minute with Safari in the background or the screen
  locked: are messages lost, and does it reconnect by itself?
- **Setup:** which wifi (home, venue or phone hotspot), laptop and iPad models, iPadOS and Safari versions. Venue wifi
  often blocks device-to-device traffic: if it can be tried there, say whether it did.
- **The real sheet:** `pnpm -C web dev --hostname 0.0.0.0`, then `http://<laptop-ip>:3000/sheet?song=twinkle` in the
  iPad's Safari. Does OpenSheetMusicDisplay render? Yes or no, and anything Next.js prints about blocked cross-origin
  dev requests. Change nothing in `web/`.

## Validation
The experiment is the validation. Each step is `action -> what you should see`.
1. **Laptop alone:** `node spikes/ipad-relay/relay.mjs`, `send.html` and `follow.html` in two Chrome tabs -> counts
   match and the delay table prints. This proves the pipeline, not the wifi.
2. **iPad** (Eric), same wifi: `http://<laptop-ip>:<port>/follow.html` -> the bar moves with the sender's clock.
3. Run 5 minutes -> counts, drops and percentiles print; save them as `run-<network>.json`. Lock the screen a minute
   and unlock -> record what happened. `verify.py --slug ipad-relay-spike` -> passes, /play unchanged.
- **Build** if one-way p95 is ≤ 100 ms, no message drops in 5 minutes, and /sheet renders on the iPad. A build adds a
  bridge in `sheet-view` forwarding the channel to the relay, and serves /sheet to the local network.
- **Park** if the delay passes but messages drop, if only venue wifi fails, or if /sheet doesn't render on the iPad
  (the relay works, but the iPad would need a lighter page).
- **Drop** if one-way p95 is over 100 ms on home wifi too.

## Defaults
- Plain JS, no build or framework; `ws` is the only dependency. Plain HTTP on the local network, no TLS or auth
  (WebSocket needs no secure context); the relay runs only during a test, never left up on venue wifi.
- Unmeasured stays `unknown`. The done note (`changes/ipad-relay-spike.md`, 3–8 lines) gives the recommendation with
  the numbers that decided it and points at FINDINGS.md.
