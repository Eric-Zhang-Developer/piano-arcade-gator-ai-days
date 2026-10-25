"use client";

// Laptop sound's install (spec: laptop-sound): layout.tsx imports this, so the wrapper is in place as soon as the
// client bundle loads, before any page's or plugin's effect asks for MIDI. Renders nothing.
import { installLaptopSound } from ".";

if (typeof window !== "undefined") installLaptopSound();

export function LaptopSound() {
  return null;
}
