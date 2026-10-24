"use client";
import type { Chart, Take } from "../../contracts";
import { midiFileName, takeToMidi } from ".";

export function DownloadMidi({ chart, take }: { chart: Chart; take: Take }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([takeToMidi(chart, take) as BlobPart], { type: "audio/midi" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: midiFileName(take) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button data-testid="download-midi" onClick={save} style={buttonStyle}>
      Download MIDI
    </button>
  );
}

// Watch replay's look, so the take's buttons read as one row.
const buttonStyle: React.CSSProperties = {
  padding: "8px 24px",
  fontSize: 16,
  borderRadius: 8,
  border: "none",
  background: "#ddd",
  color: "#000",
  cursor: "pointer",
};
