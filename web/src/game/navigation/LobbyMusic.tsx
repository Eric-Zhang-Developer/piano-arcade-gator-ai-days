"use client";
import { useEffect, useSyncExternalStore } from "react";
import styles from "../options-panel/options-panel.module.css";
import { hydrateLobby, lobbyServerSnapshot, lobbySnapshot, playLobbyMusic, setLobbyVolume, stopLobbyMusic, subscribeLobby } from "./music";
export function LobbyMusic() {
  const state = useSyncExternalStore(subscribeLobby, lobbySnapshot, lobbyServerSnapshot);
  useEffect(() => { hydrateLobby(); return () => stopLobbyMusic(); }, []);
  return <section aria-label="Lobby music" className={styles.row}>
    <label className={styles.label} htmlFor="opt-lobby">Lobby music</label>
    <input id="opt-lobby" aria-label="Lobby music" data-row className={styles.check} type="checkbox" checked={state.playing} onChange={() => state.playing ? stopLobbyMusic(true) : void playLobbyMusic()} />
    <label className={styles.control}>Volume <input aria-label="Lobby music volume" data-row type="range" min="0" max="1" step="0.01" value={state.volume} onChange={e => setLobbyVolume(Number(e.target.value))} /><output className={styles.value}>{Math.round(state.volume * 100)}%</output></label>
    <small role="status" style={{ gridColumn: "1 / -1", color: "var(--pa-ink-dim)" }}>{state.status}</small>
  </section>;
}
