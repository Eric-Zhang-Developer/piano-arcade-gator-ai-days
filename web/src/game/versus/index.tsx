// Versus (spec: versus): ?versus=1 splits the keyboard at middle C, and each half plays the same part an octave or
// more apart. Core judges one chart that holds both copies; this plugin keeps each player's tally from the events.
import type { CSSProperties } from "react";
import type { GamePlugin } from "../../contracts";
import { settings } from "../core/settings";
import { accuracy, emptyTally, MIDDLE_C, reduceTallies, versusChart, winner, type Player, type Tally } from "./split";

export { versusChart, reduceTallies, accuracy, winner, emptyTally } from "./split";

const fresh = () => ({ p1: emptyTally(), p2: emptyTally() });

export function versus(): GamePlugin {
  let on = false;
  let refused = false;
  let tallies: Record<Player, Tally> = fresh();

  return {
    id: "versus",
    transformChart(c, params) {
      on = refused = false;
      if (params.get("versus") !== "1") return c;
      const split = versusChart(c);
      if (!split) {
        refused = true;
        console.warn("versus: this song doesn't fit versus; playing it normally");
        return c;
      }
      on = true;
      return split;
    },
    onEvent(e) {
      if (!on) return;
      if (e.type === "songStart") tallies = fresh();
      else tallies = reduceTallies(tallies, e);
    },
    draw(ctx, f) {
      if (!on) return;
      const split = f.keyX(MIDDLE_C).x;
      const y = f.judgmentLineY * 0.22;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(split - 1, y - 40, 2, f.judgmentLineY - y + 40); // the split line
      for (const [who, x] of [["p2", split / 2], ["p1", (split + f.width) / 2]] as const) {
        const t = tallies[who];
        ctx.textAlign = "center";
        ctx.fillStyle = settings.noteColor;
        ctx.font = "italic 900 40px system-ui, sans-serif";
        ctx.fillText(who.toUpperCase(), x, y);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "600 18px system-ui, sans-serif";
        ctx.fillText(`${t.combo} combo · ${(accuracy(t) * 100).toFixed(1)}%`, x, y + 26);
      }
    },
    startPanel: () => (refused ? <p data-testid="versus-refused">This song doesn&apos;t fit versus</p> : null),
    resultsPanel: () => (on ? <VersusResults tallies={tallies} /> : null),
  };
}

function VersusResults({ tallies }: { tallies: Record<Player, Tally> }) {
  return (
    <div data-testid="versus" style={{ textAlign: "center" }}>
      <div data-testid="versus-winner" style={{ fontSize: 48, fontWeight: 900, fontStyle: "italic", color: settings.noteColor }}>
        {winner(tallies)}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
        {(["p1", "p2"] as const).map((who) => {
          const t = tallies[who];
          return (
            <div key={who} data-testid={`versus-${who}`} style={column}>
              <b style={{ fontSize: 22 }}>{who.toUpperCase()}</b>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{(accuracy(t) * 100).toFixed(1)}%</span>
              <span>
                {t.PERFECT} PERFECT · {t.GREAT} GREAT · {t.GOOD} GOOD
              </span>
              <span>
                {t.MISS} MISS · {t.wrong} wrong · max combo {t.maxCombo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const column: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, fontSize: 15 };
