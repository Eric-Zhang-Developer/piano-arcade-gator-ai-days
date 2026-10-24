export type GamePhase = "ready" | "playing" | "paused" | "results";
let phase: GamePhase = "ready";
const listeners = new Set<() => void>();
export const navigationPhase = () => phase;
export const subscribePhase = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export function setNavigationPhase(value: GamePhase) { phase = value; listeners.forEach(callback => callback()); }

// Sheet/practice/calibration/simulator pages accept musical input for other
// purposes. Never interpret those notes as menu commands.
export const menuAllowed = (path: string, value = phase) =>
  path === "/" || path.startsWith("/progress") || path === "/play" && value !== "playing";
