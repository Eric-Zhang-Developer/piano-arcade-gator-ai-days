// /how's two tabs: the build, and CI. Plain links, so each tab is its own server-rendered page.
import { MonoLabel } from "../game/duo-tokens";
import s from "./ci.module.css";

const TABS = [
  { href: "/how", label: "The build" },
  { href: "/how/ci", label: "CI" },
] as const;

export function Tabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav className={s.tabs} aria-label="How it works">
      {TABS.map((t) => (
        <a key={t.href} href={t.href} className={s.tab} aria-current={t.href === current ? "page" : undefined}>
          <MonoLabel dim={t.href !== current}>{t.label}</MonoLabel>
        </a>
      ))}
    </nav>
  );
}
