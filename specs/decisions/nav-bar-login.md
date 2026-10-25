# nav-bar: the login link stays where it is

**Context.** The spec asks to move `/`'s login link into the bar, reusing its component, "if it can't move without
changing another lane's folder, leave it where it is and log why".

**Finding.** The login link is `AccountChip` (`web/src/app/auth/AccountChip.tsx`, sharan's lane). Its position is
inline in that file: `position: fixed; right: 24; bottom: 24`, with its own panel and border. Mounting it inside the
bar would still pin it to the bottom-right corner. Making it sit in a row needs a prop or a style change in sharan's
folder.

**Choice.** Leave it at the bottom right of `/`, mounted by `app/page.tsx` as today. The bar carries the pages and
not the account. Progress is a slot, so a signed-in player's history is still one click away.

**How to undo.** When `AccountChip` takes a `placement` (a `needs-human` ask for sharan), render it at the bar's right
end and drop it from `app/page.tsx`.

**GitHub link (2026-10-25).** Eric asked for the repo link "at the right, next to login". Login can't join the bar
(above), so the GitHub link is the bar's last item, set a little apart from the pages because it leaves the site. If
AccountChip later moves into the bar, it goes right after GitHub.
