"use client";
// /musicbox (spec: pinned): your take as a brass music-box cylinder, with an STL. Reached from the Lab, and from /play's
// results with ?x=pinned.
import dynamic from "next/dynamic";

// Browser-only: WebGL, Web Audio and sessionStorage.
export default dynamic(() => import("../../game/x/pinned/Pinned").then((m) => m.Pinned), { ssr: false });
