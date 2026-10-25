"use client";
// /paint (spike: wet-paint): free play where every note blooms as paint. Reached from the Lab.
import dynamic from "next/dynamic";

// Browser-only: WebGL, Web MIDI and the laptop piano.
export default dynamic(() => import("../../game/x/wet-paint/WetPaint").then((m) => m.WetPaint), { ssr: false });
