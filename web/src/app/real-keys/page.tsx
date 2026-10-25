"use client";
// Real Keys (spec: real-keys): an experiment's own page; the Lab and /play?x=real-keys link here.
import dynamic from "next/dynamic";

// Browser-only: the camera, Web MIDI and WebGL sparks.
export default dynamic(() => import("../../game/x/real-keys/RealKeys").then((m) => m.RealKeys), { ssr: false });
