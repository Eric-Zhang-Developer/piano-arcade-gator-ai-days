"use client";
import { useEffect, useSyncExternalStore } from "react";
import { hydrateLobby, lobbyServerSnapshot, lobbySnapshot, playLobbyMusic, setLobbyVolume, stopLobbyMusic, subscribeLobby } from "./music";

export function LobbyMusic() {
  const state = useSyncExternalStore(subscribeLobby, lobbySnapshot, lobbyServerSnapshot);
  useEffect(() => { hydrateLobby(); return () => stopLobbyMusic(); }, []);
  return <section aria-label="Lobby music" style={{ width: "100%", font: "12px/1.5 system-ui" }}>
    <button onClick={() => state.playing ? stopLobbyMusic(true) : void playLobbyMusic()}>{state.playing ? "Stop lobby music" : "Play lobby music"}</button>
    <button aria-label="Lobby volume down" onClick={() => setLobbyVolume(state.volume - .05)}>−</button>
    <label style={{ margin: "0 8px" }}>Volume <input aria-label="Lobby music volume" type="range" min="0" max="1" step="0.01" value={state.volume} onChange={e => setLobbyVolume(Number(e.target.value))} style={{ width: 80, verticalAlign: "middle" }} /></label>
    <button aria-label="Lobby volume up" onClick={() => setLobbyVolume(state.volume + .05)}>+</button>
    <div role="status">{state.status}</div>
  </section>;
}
