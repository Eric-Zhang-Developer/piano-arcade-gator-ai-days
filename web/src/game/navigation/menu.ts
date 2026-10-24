import type { InputEvent } from "../../contracts";

export type MenuAction = "home" | "previous" | "next" | "select";
export const menuNotes: Record<number, MenuAction> = { 47: "home", 48: "previous", 50: "next", 52: "select" };

export function menuInput(allowed: () => boolean, action: (value: MenuAction) => void) {
  const held = new Set<number>();
  return (event: InputEvent) => {
    if (event.type === "off") { held.delete(event.pitch); return; }
    if (held.has(event.pitch)) return;
    held.add(event.pitch); // also track performance notes across a phase change
    if (allowed() && menuNotes[event.pitch]) action(menuNotes[event.pitch]);
  };
}

export function focusables(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(":disabled,[aria-disabled=true]") && element.getClientRects().length > 0);
}

export function performMenuAction(action: MenuAction) {
  const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
  if (action === "home") {
    if (dialog) dialog.close();
    else document.querySelector<HTMLAnchorElement>('a[aria-label="Home — song selection"],a[href="/"],button[data-home]')?.click();
    return;
  }
  const controls = focusables(dialog ?? document);
  const active = document.activeElement as HTMLElement | null;
  if (action === "select") { if (active && controls.includes(active)) active.click(); return; }
  if (!controls.length) return;
  const at = controls.indexOf(active!);
  const next = at < 0 ? 0 : (at + (action === "next" ? 1 : -1) + controls.length) % controls.length;
  controls[next].focus();
}
