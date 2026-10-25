"use client";
import type { Chart, Take } from "../../contracts";
import { Button } from "../duo-tokens";
import { midiFileName, takeToMidi } from ".";

export function DownloadMidi({ chart, take }: { chart: Chart; take: Take }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([takeToMidi(chart, take) as BlobPart], { type: "audio/midi" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: midiFileName(take) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Button kind="secondary" data-testid="download-midi" onClick={save}>
      Download MIDI
    </Button>
  );
}
