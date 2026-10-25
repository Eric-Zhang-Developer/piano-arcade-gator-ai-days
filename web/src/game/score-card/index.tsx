"use client";
// Score card (spec: score-card): "Save card" on the results draws the take as a 1920×1080 PNG and downloads it. All in
// the browser: no upload, no server. Before bar-loop in layers.ts, so transformChart sees the song's own title.
import { useState } from "react";
import type { Chart, GamePlugin } from "../../contracts";
import { emptyHud, reduceHud } from "../hud";
import { whenDisplayFontReady } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";
import { CARD_H, CARD_W, cardModel, drawCard, type CardModel } from "./card";
import styles from "./score-card.module.css";

export function scoreCard(): GamePlugin {
  let song: Chart | null = null;
  let params = new URLSearchParams();
  let hud = emptyHud(); // the score the player saw, rebuilt with the HUD's own reducer (as records does)
  return {
    id: "score-card",
    transformChart(c, p) {
      song = c;
      params = p;
      return c;
    },
    onEvent(e) {
      hud = reduceHud(hud, e);
    },
    // Wait mode isn't scored: no card.
    resultsPanel: ({ take, results }) =>
      song && !isWaitMode(params) ? <SaveCard model={cardModel(song, results, hud.score, new Date(take.startedAt), params)} /> : null,
  };
}

function SaveCard({ model }: { model: CardModel }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await whenDisplayFontReady();
      const root = getComputedStyle(document.documentElement);
      const family = root.getPropertyValue("--pa-font-display").trim();
      const data = root.getPropertyValue("--pa-font-data").trim();
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2D canvas");
      drawCard(ctx, model, family ? `${family}, system-ui, sans-serif` : undefined, data ? `${data}, ui-monospace, monospace` : undefined);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("no PNG");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = model.file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setFailed(true); // no canvas, or the browser wouldn't encode it
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className={styles.wrap}>
      <button data-testid="save-card" className={styles.button} disabled={busy} onClick={save}>
        Save card
      </button>
      {failed && (
        <span role="status" className={styles.failed}>
          Couldn&apos;t save the card in this browser
        </span>
      )}
    </span>
  );
}

