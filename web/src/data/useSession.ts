"use client";

import { useEffect, useState } from "react";
import { getSession, onSessionChange, type Session } from "./auth";

/**
 * Who's playing in this browser, kept current: undefined while checking, null when nobody has a session yet, else the
 * guest or Google player. Every screen that shows the account reads this one hook, so they never disagree.
 */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const read = () => void getSession().then((s) => live && setSession(s));
    read();
    const stop = onSessionChange(read);
    return () => {
      live = false;
      stop();
    };
  }, []);
  return session;
}
