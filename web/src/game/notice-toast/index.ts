// One toast stack for the game's notices (spec: notice-toast). `toast(text)` is a plain function any plugin can call:
// no React. The stack lives on document.body, top right under the HUD band, newest on top, at most 3.
export const toastSettings = {
  ms: 4000, // a toast is gone by then
  max: 3, // a fourth makes the oldest leave early
  leaveMs: 200, // the fade out, inside `ms`
};

export interface Toast {
  id: number;
  text: string;
  leaving: boolean;
}

// The queue, pure apart from setTimeout, Date.now and `frame`, so it tests with fake timers and no DOM. `render` gets the toasts
// newest first, leaving ones included until they're gone. Each toast's removal is timed from its own deadline, not
// chained after the fade's timer: on a busy machine each timer fires late, and two late timers in a row kept a toast
// 4106–4139 ms on CI (#432).
// `frame` (requestAnimationFrame) checks every deadline once per frame while a toast shows: on a starved page each
// frame is a long task and Chrome runs frames ahead of timers, so the leave's setTimeout alone kept a toast 4130–4387 ms
// at 6x CPU throttle (#584). A frame is never skipped for a timer; the timers stay for tabs that draw no frames.
export function toastStack(render: (toasts: readonly Toast[]) => void, reduced: () => boolean, frame?: (cb: () => void) => void) {
  let toasts: Toast[] = [];
  let next = 0;
  const deadline = new Map<number, number>(); // id -> Date.now() it must be gone by
  const remove = (id: number) => {
    toasts = toasts.filter((t) => t.id !== id);
    deadline.delete(id);
    render(toasts);
  };
  const leave = (id: number) => {
    const t = toasts.find((x) => x.id === id);
    if (!t || t.leaving) return;
    if (reduced()) return remove(id); // no fade: it goes at once
    t.leaving = true;
    render(toasts);
    // The fade, cut short if the leave itself fired late: never past the deadline.
    setTimeout(() => remove(id), Math.max(0, Math.min(toastSettings.leaveMs, (deadline.get(id) ?? 0) - Date.now())));
  };
  let watching = false;
  const sweep = () => {
    const now = Date.now();
    for (const t of toasts) {
      const d = deadline.get(t.id) ?? 0;
      if (now >= d) remove(t.id);
      else if (now >= d - toastSettings.leaveMs) leave(t.id);
    }
    watching = toasts.length > 0;
    if (watching) frame?.(sweep);
  };
  return (text: string) => {
    const t: Toast = { id: next++, text, leaving: false };
    deadline.set(t.id, Date.now() + toastSettings.ms);
    toasts = [t, ...toasts];
    for (const old of toasts.filter((x) => !x.leaving).slice(toastSettings.max)) leave(old.id);
    render(toasts);
    // Both motions leave at 3.8 s: reduced motion goes at once (no fade), so a timer firing up to 200 ms late on a busy
    // machine still has it gone by 4 s. A 4 s timer had no slack and kept it 4141–4155 ms on CI (#584).
    setTimeout(() => leave(t.id), toastSettings.ms - toastSettings.leaveMs);
    if (frame && !watching) {
      watching = true;
      frame(sweep);
    }
  };
}

// Below the HUD band (hudLayout caps it at 84 px) and inside the top half, where every note is still over 700 ms from
// the line: three toasts at 24 px end near 320 px of 1080. Text is 16 px at 720 high and 24 px at 1080 (the video rule).
export const toastCss = `
.pa-toasts { position: fixed; top: 96px; right: 16px; z-index: 950; display: flex; flex-direction: column; gap: 8px;
  align-items: flex-end; pointer-events: none; }
.pa-toast { background: var(--pa-panel); color: var(--pa-ink); border-left: 3px solid var(--pa-cyan);
  max-width: min(18em, 40vw); padding: 0.45em 0.8em; font: 500 clamp(16px, 2.2223vh, 24px) / 1.3 system-ui, sans-serif;
  box-shadow: 0 0 0 1px rgba(39, 225, 255, 0.18); backdrop-filter: blur(8px); animation: pa-toast-in 200ms ease-out;
  transition: opacity 200ms ease-out, transform 200ms ease-out; }
.pa-toast[data-leaving] { opacity: 0; transform: translateX(16px); }
@keyframes pa-toast-in { from { opacity: 0; transform: translateX(16px); } }
@media (prefers-reduced-motion: reduce) { .pa-toast { animation: none; transition: none; } }
`;

let push: ((text: string) => void) | null = null;

function domStack(): (text: string) => void {
  const style = document.createElement("style");
  style.textContent = toastCss;
  document.head.appendChild(style);
  const box = document.createElement("div");
  box.className = "pa-toasts";
  box.setAttribute("role", "status");
  box.setAttribute("aria-live", "polite");
  document.body.appendChild(box);
  const els = new Map<number, HTMLElement>();
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return toastStack((toasts) => {
    for (const [id, el] of els)
      if (!toasts.some((t) => t.id === id)) {
        el.remove();
        els.delete(id);
      }
    for (const t of toasts) {
      let el = els.get(t.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "pa-toast";
        el.setAttribute("data-testid", "toast");
        el.textContent = t.text; // never as HTML: a notice can carry a bot name from the URL
        els.set(t.id, el);
        box.prepend(el); // newest on top; the others stay put, so their slide-in doesn't restart
      }
      if (t.leaving) el.setAttribute("data-leaving", "");
    }
  }, reduced, (cb) => requestAnimationFrame(cb));
}

export function toast(text: string): void {
  if (typeof document === "undefined" || !document.body) return;
  push ??= domStack();
  push(text);
}
