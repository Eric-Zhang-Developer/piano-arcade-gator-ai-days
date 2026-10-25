import { doneSlots } from "./done";
import { NavLinks } from "./NavLinks";

// The nav bar (spec: nav-bar), mounted once in the root layout: the done slots, read on the server, drawn by NavLinks.
export function NavBar() {
  return <NavLinks slots={doneSlots()} />;
}
