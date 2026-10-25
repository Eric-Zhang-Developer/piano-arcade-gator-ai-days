# select-a11y: how "Song N of M" is heard (#1237)

**Context.** The select's place counter named a plain `<span>` with `aria-label`. A span has no role, so readers skip
the name.

**Options.** A: hide the visible `N / M` from readers and put an sr-only "Song N of M" beside it. B: give the counter
a role that takes a name (`role="status"` or `img`).

**Choice.** A. The text is read as text everywhere, and it adds no live region: the focused panel's line already speaks
on each step (#1236), and a second polite region would read twice. `verify-main.mjs` still reads `1 / N` from
`list-place`, because the sr-only text sits beside it, not inside it.

**Also.** The GitHub link is now an icon mark with no "↗" (nav-bar-layout), so only its `aria-label` changes, to
"GitHub (opens in a new tab)". `verify-nav.mjs` checked the old label, so it now checks the new one.

**How to undo.** Revert the commit.
