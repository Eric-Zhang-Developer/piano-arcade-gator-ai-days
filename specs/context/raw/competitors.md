# Piano hack: competitors

Researched October 23, 2026. Covers Simply Piano, Flowkey, Yousician (piano) and Playground Sessions.
Companion files: `handoff.md` (current state), `transcript-abridged-piano-project.md` (history).

Labels: **[verified]** means read on a primary or reputable page. **[unverified]** means secondhand or not confirmed. "Not found" means we looked and found no evidence, which is not proof it doesn't exist.

Limits of this research: Reddit blocked every request, so community opinion comes only from aggregators and is unverified. Piano Marvel was not researched, though Reddit aggregators rate it above Simply Piano and Flowkey (see "Still open").

---

## 1. The finding

All four apps grade *which* notes you hit. None of them grades *how* you played them. None lets you bring your own song. All of them top out around intermediate. Those three gaps match our middle player (their own song) and advanced player (timing, evenness, dynamics).

Pitch line the evidence supports: *"Every app we checked grades whether you hit the note. None of them grades how you played it, and none of them will teach you a song they haven't licensed."*

## 2. Side by side

| | Simply Piano | Flowkey | Yousician | Playground Sessions |
|---|---|---|---|---|
| **Price (US)** | ~$120/yr | $100/yr Classic, $150/yr Premium | $120/yr for piano only, $160–180/yr for all instruments | $100–150/yr, lifetime $220–350 |
| **Input** | Mic, wired MIDI | Mic, USB MIDI, Bluetooth MIDI (iOS) | Mic, USB and Bluetooth MIDI | MIDI first; mic in beta since Oct 2025 |
| **Catalog** | 5,000+ songs | Thousands, licensed; **songs expire** | Thousands, licensed; varies by country | ~2,000 (about half public domain) |
| **Your own songs** | Not found | Not found | **Removed in 2018** | **Explicitly refused** |
| **What it grades** | Right note; off-rhythm still scores green | Right note; far too fast still passes | Notes and timing; stars only | Right, wrong, or "wrong time"; no early vs. late |
| **Dynamics / velocity** | Not found | Not found | Not found | Not found |
| **Review after a take** | Not found | None | Stars and score only | Marks stay on the score |
| **Wait mode** | Yes | Yes (most praised feature) | Not in piano docs | Not found |
| **Loop, slow-down, hands separate** | Yes | Yes | Yes | Yes |
| **Ceiling** | Early intermediate | Advanced "does not go deep" | "Intermediate at best" | "Advanced" is closer to intermediate |
| **Piano AI** | "AI-powered feedback" with finger tracking, Vision Pro only | None found | None (guitar-only AI teacher "June") | None found |

## 3. What they do right

Don't compete on these. They're either expected or hard to match in 48 hours.

- **Polished beginner onboarding and gamification.** Simply Piano has 4.7★ from 859K App Store ratings. Three of the four research reports said not to try to win the Hot Cross Buns player on polish.
- **Loop, slow-down and hands-separate practice.** Every app has them, so they're table stakes. We need them too, but they won't impress anyone.
- **Professionally arranged, licensed pop.** Flowkey adds pianist video and Playground adds video teachers. This is their moat. If our auto-generated arrangements sound worse, the middle player won't trust them.
- **Wait mode.** Flowkey's most-praised feature, and confirmation that ours belongs in the beginner flow.

## 4. What they do wrong

1. **Shallow feedback.** Every reviewer who knows piano raises it. Off-rhythm or too-fast playing still passes, and there's no post-take breakdown. A pianist reviewer asked Yousician for a "perfect / late / incorrect" breakdown, which is close to what our replay does.
2. **Catalogs shrink.** Flowkey's top complaint in Sep–Oct 2026 reviews is songs disappearing mid-learning, and upgrading doesn't bring them back. Yousician songs vary by country and get removed.
3. **The plateau.** None of them has material for someone working on a Ballade.
4. **The microphone.** All four companies' own help docs say MIDI is more accurate.
5. **Billing.** Simply, Yousician and Playground all have recent complaints about charges after cancelling and support that doesn't respond.

## 5. What it means for our three players

- **Beginner: table stakes plus one moment.** Wait mode, looping and slow-down are expected. Our difference is the piano playing your mistakes back.
- **Middle player: no app fills this gap, and it's our biggest quality risk.** Song import exists in none of them, and Playground explicitly refuses uploads. But we're up against arrangements that sound good, which makes the "Golden" transcription test (handoff §13) the check that matters most for this player.
- **Advanced player: the widest-open gap, and the cheapest to fill.** Timing direction (early vs. late), evenness and dynamics all come from MIDI timestamps and velocity after alignment. There's no ML risk, and no app does it.
- **AI teacher: open for piano.** Yousician shipped one for guitar in October 2026, so the field is heading there. "First AI teacher for piano" is **[unverified]**: we checked four apps, not the whole market.
- **MIDI first:** the DGX-660 over USB avoids the accuracy complaint every competitor admits to.
- **Likely judge question:** "Why not just use Flowkey on your Yamaha?" Yamaha bundles free Flowkey Premium months with its keyboards [verified]. Answer: it can't teach a song it hasn't licensed, and it doesn't grade timing or dynamics.

---

## 6. Per-app notes

### Simply Piano (Simply Ltd, formerly JoyTunes)

- **Platforms:** iOS, Android, Chromebook, Vision Pro (Dec 2024), Android XR (2025). [verified]
- **Pricing:** App Store prices are Individual $119.99, Family $179.99, 3 months $74.99. The free tier is two intro courses, and the 7-day trial is on the yearly plan only. [verified]
- **Input:** mic by default, wired USB/DIN MIDI. Bluetooth MIDI is not officially supported. Simply's own help center says MIDI gives "perfect note recognition", which concedes that the mic struggles. [verified]
- **Catalog:** 5,000+ songs with new songs monthly [verified]. No stated licensing deal or user import found.
- **Feedback:** mostly right or wrong note. A pianist reviewer says off-rhythm playing scores "all green" and that note length isn't checked [verified, review]. It has a "Wait for me" mode and tempo practice at 85%/95%.
- **Learning path:** 23–28 courses, with Soloist (classical) and Chords (pop) branches. The ceiling is early intermediate. [verified, reviews]
- **Praised:** onboarding, gamification, the big library. A large share of App Store reviews are from beginners who reached two-handed songs.
- **Criticized:**
  - Billing and cancellation (Trustpilot 2.3–2.5, small sample).
  - Binary feedback.
  - Clumsy, oversimplified arrangements.
  - The plateau.
- **AI:** Simply Piano XR advertises "AI-powered feedback" with finger tracking [verified, vendor]. A Meta Ray-Ban Display version was reportedly shown at Meta Connect 2026 [unverified]. No AI teacher in the core app.

Sources:
- https://www.hellosimply.com/simply-piano
- https://en.wikipedia.org/wiki/Simply_(software_company)
- https://apps.apple.com/us/app/simply-piano-learn-piano-fast/id1019442026
- https://play.google.com/store/apps/details?id=com.joytunes.simplypiano
- https://piano-help.hellosimply.com/en/articles/11056528
- https://piano-help.hellosimply.com/en/articles/6210608
- https://piano-help.hellosimply.com/en/articles/7943680-understanding-play
- https://piano-help.hellosimply.com/en/articles/10285191-simply-piano-xr
- https://pianistscompass.org/?p=9588
- https://pianoers.com/simply-piano/
- https://ca.trustpilot.com/review/joytunes.com
- https://violetrecording.com/simply-piano-review/ [unverified]
- https://gummysearch.com/tools/best-products/piano-app/ [unverified, Reddit aggregator]

### Flowkey (flowkey GmbH, Berlin)

- **Platforms:** iOS, Android, web app, Windows Store. [verified]
- **Pricing:** Classic (courses plus classical and public domain) is $16.49/mo or $99.99/yr. Premium (adds pop, film, games, ABRSM pieces) is $24.99/mo or $149.99/yr. Family is $224.99/yr. There's no lifetime plan; a free tier of a few songs has no time limit. [verified]
- **Input:** mic, USB MIDI, and Bluetooth MIDI on iOS only. Flowkey's own help docs say MIDI gives "nearly perfect" recognition. App Store and Trustpilot reviews complain about the mic on chords and fast passages. [verified]
- **Catalog:** licensed songs that **expire**, with an "Available for X more days" warning. Size is "thousands" per Flowkey and 1,500+ per a reviewer. Songs come in 4 difficulty levels. No user import found. [verified]
- **Feedback:** right notes only. A teacher reviewer found that playing far too fast still passes, that it "lacks quality feedback", and that it has no metronome. There's no error summary after a run, which an App Store reviewer complains about. It has Wait Mode, Loop, slow-down to 50%/75%, hand selection and "Just Play". [verified]
- **Learning path:** 8 courses, beginner to advanced, covering reading, scales, chords, improvisation and basic technique. Advanced material "does not go deep." Hackernoon says it "teaches mimicry more than independent musicianship." [verified]
- **Praised:** Wait Mode, a polished library, the video-plus-sheet-music view, gentle pacing. Yamaha bundles include free Premium months.
- **Criticized:**
  - Songs disappearing (the top complaint; Trustpilot 4.0 from 420 reviews).
  - The split between Classic and Premium song access.
  - Mic accuracy.
  - Shallow feedback.
  - No billing horror stories found.
- **AI:** none found beyond its long-standing pitch recognition.

Sources:
- https://www.flowkey.com/en
- https://help.flowkey.com/articles/4466337
- https://help.flowkey.com/en/articles/412925-connect-your-instrument-with-your-pc-mac
- https://help.flowkey.com/en/articles/412902-connect-your-android-device-via-midi
- https://help.flowkey.com/en/articles/896573-connect-your-instrument-to-your-iphone
- https://help.flowkey.com/en/articles/8975623-why-are-some-songs-no-longer-available-on-flowkey
- https://apps.apple.com/us/app/flowkey-learn-to-play-piano/id1020357408
- https://apps.microsoft.com/detail/9nblggh4sskn
- https://www.trustpilot.com/review/flowkey.com
- https://pianistscompass.org/?p=6933
- https://hackernoon.com/lite/best-piano-learning-apps-in-2026-an-in-depth-comparison-of-music-education-technology
- https://hub.yamaha.com/?p=41160
- https://danhon.substack.com/p/flowkey-review [unverified]
- https://gummysearch.com/tools/best-products/piano-learning-app/ [unverified, Reddit aggregator]

### Yousician (piano)

- **Company and platforms:** Finnish, founded 2010. Covers guitar, piano, ukulele, bass and singing on iOS, Android and desktop. A separate "Piano by Yousician" iOS app is rated 4.7 from 23K ratings. [verified]
- **Pricing:** Premium for one instrument is $19.99/mo or $119.99/yr. Premium+ for all five instruments is $29.99/mo or $159.99–179.99/yr. The free trial needs a card and converts to paid automatically. [verified] The free-tier limits conflict across sources. [unverified]
- **Input:** mic, USB and Bluetooth MIDI. Yousician says MIDI "improves note recognition", and a January 2026 review calls detection "very good, especially with a MIDI keyboard." [verified]
- **Catalog:** licensed, varies by country, and songs get removed. User-uploaded songs were removed in 2018. Size is "thousands of songs" and "1,500+ missions and exercises." [verified]
- **Feedback:** judges "accuracy and timing." The end screen shows stars, score and a leaderboard only. Practice tools are a loop slider, tempo from 25% to 125% with auto-adjust, hands separate, "Play for me" and a metronome. Wait mode is documented for guitar and bass but not piano. [verified]
- **Learning path:** Basics through Level 9 in Classical and Pop tracks, plus five Knowledge (theory) levels. Four notation modes, from falling notes to standard sheet music. Advanced content is "verging on intermediate at best." [verified]
- **Praised:** a clean game-like UI, a choice of notation, tempo and loop tools, and one subscription for several instruments. Ratings are 4.6 from 139K on iOS and 3.9 from 1,322 on Trustpilot.
- **Criticized:**
  - Billing: charges after cancelling, renewal without notice, unresponsive support. Many reviews from Nov 2025 to Aug 2026. [verified]
  - Lessons don't stop for wrong notes, so you can pass while sloppy.
  - Stars-only feedback.
  - The plateau.
- **AI:** "June", an AI guitar teacher, is a separate guitar-only app (v2.0, October 2026). GuitarTuna Play uses AI to scroll chord sheets. No piano AI found. [verified]

Sources:
- https://www.yousician.com/piano
- https://en.wikipedia.org/wiki/Yousician
- https://apps.apple.com/us/app/piano-by-yousician/id1469033443
- https://apps.apple.com/us/app/-/id1640426327
- https://support.yousician.com/hc/en-us/articles/360000336137
- https://support.yousician.com/hc/en-us/articles/204799551
- https://support.yousician.com/hc/en-us/articles/46277319890449
- https://support.yousician.com/hc/en-us/articles/360000758937
- https://support.yousician.com/hc/en-us/articles/33960319680145
- https://support.yousician.com/hc/en-us/articles/208014795
- https://support.yousician.com/hc/en-us/articles/204796991
- https://support.yousician.com/hc/en-us/articles/204697992
- https://support.yousician.com/hc/en-us/articles/208678605
- https://pianistscompass.org/?p=15355
- https://www.trustpilot.com/review/yousician.com
- https://www.getmaxim.ai/blog/building-the-future-of-music-education-yousicians-journey-with-maxim-ai/
- https://www.guitarworld.com/news/yousician-guitartuna-play
- https://forums.welltrainedmind.com/topic/615198-does-anyone-use-yousician/ [unverified]

### Playground Sessions (co-created with Quincy Jones)

- **Platforms:** iPad, iPhone, Android, Windows, Mac. Still actively developed: iOS v3.5.2 shipped October 9, 2026, and a teacher/classroom program was added around August 2026. [verified]
- **Pricing (fall sale):**
  - Monthly is $19.99.
  - Annual is $149.99 list, with the first year at $99.99.
  - Lifetime is $349.99 list ($219.99 on sale), but it includes only 2 years of copyrighted songs. After that it's $3.33/month or $0.99 per song.
  - There's a 7-day trial, a 30-day money-back guarantee, and no ongoing free tier found. [verified]
- **Input:** USB/MIDI, plus mic in beta since October 2025. Its own help article admits the mic only gives feedback at the end of a section and can score backing tracks as your notes. [verified] Trustpilot reports Windows latency since an Electron rewrite. [verified as user claims] A January 2026 review found scoring glitches: wrong note lengths scored 100%, and an all-green take scored 83%. [verified]
- **Catalog:** 1,000+ copyrighted and 1,000+ public-domain songs in Rookie, Intermediate and Advanced arrangements. Only Advanced is true to the original. **No uploads**: "users are not able to upload songs" (help article updated October 14, 2026). [verified]
- **Feedback:** green is right, red is wrong, pink is "at the wrong time", with no split between early and late. You get a percentage at the end, and 80% passes a segment. Marks stay on the score after a take. Practice tools are loop by measure, tempo presets, hand demos and hands-separate practice. No wait mode or replay of your own take found. [verified]
- **Learning path:** Bootcamp has Rookie (93 stages), Intermediate (63) and Advanced (25), plus courses on reading, rhythm, chords, playing by ear and pedaling. "Advanced" is closer to intermediate. [verified]
- **Praised:** short video teachers (David Sides, Mike Garson), instant color feedback, loop plus slow-down, band backing tracks, songs in three levels.
- **Criticized:**
  - The plateau.
  - Difficulty jumps within Rookie.
  - Billing: failed gift codes, a charge after cancelling, month-long support replies, and the lifetime plan's 2-year song limit.
  - Windows latency.
  - Simplified arrangements.
- **AI:** none found. The app listing describes a "proprietary system" built on learner data. [verified]

Sources:
- https://www.playgroundsessions.com/
- https://www.playgroundsessions.com/choose-free-trial
- https://www.playgroundsessions.com/teachers
- https://apps.apple.com/us/app/id1139846930
- https://support.playgroundsessions.com/hc/en-us/articles/40387576759956
- https://support.playgroundsessions.com/hc/en-us/articles/360001216026
- https://support.playgroundsessions.com/hc/en-us/articles/360001202123
- https://support.playgroundsessions.com/hc/en-us/articles/360026238851
- https://support.playgroundsessions.com/hc/en-us/articles/4408365708948
- https://support.playgroundsessions.com/hc/en-us/articles/360001009446
- https://support.playgroundsessions.com/hc/en-us/articles/360022634351
- https://www.trustpilot.com/review/playgroundsessions.com
- https://pianistscompass.org/?p=8094
- https://www.toptenreviews.com/playground-sessions-review [unverified]
- https://deviantnoise.net/education/piano/playground-sessions-review/ [unverified]
- https://danhon.substack.com/p/playground-sessions-review [unverified]

---

## 7. Still open

- **Piano Marvel:** not researched. Reddit aggregators rate it 4.5, above Simply Piano (4.0) and Flowkey (3.9) [unverified]. It's said to be more serious about assessment, which makes it the most likely answer to "doesn't X already do this?" Check it before judging.
- **Synthesia and LED visualizer projects:** named as prior art in the handoff, but not researched here.
- **Reddit sentiment:** blocked for every agent. Worth a manual skim of r/piano for each app if there's time.
