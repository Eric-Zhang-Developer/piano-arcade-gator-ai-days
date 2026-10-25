import { isSyntheticId, syntheticLearner } from '../mastery/sim';

/** `/learn?as=synthetic-042` views every /learn page as that synthetic learner, for this tab only. */
export const VIEW_AS_PARAM = 'as';
export const VIEW_AS_KEY = 'pianoArcade.viewAs.v1';
/** Where this tab keeps what is appended while viewing: never Supabase and never the device's mastery keys. */
export const SYNTHETIC_KEY = 'pianoArcade.viewAs.attempts.v1';

const known = (id: string | null): id is string => id !== null && isSyntheticId(id) && syntheticLearner(id) !== null;

/**
 * The synthetic learner this tab views /learn as, or null for the device's own. A known id in `?as=` sets it; any
 * other id there is ignored. It lives in `sessionStorage`, so it survives a reload but not a new tab.
 */
export function viewingAs(): string | null {
  if (typeof window === 'undefined') return null;
  const asked = new URLSearchParams(window.location.search).get(VIEW_AS_PARAM);
  try {
    if (known(asked)) {
      sessionStorage.setItem(VIEW_AS_KEY, asked);
      return asked;
    }
    const kept = sessionStorage.getItem(VIEW_AS_KEY);
    return known(kept) ? kept : null;
  } catch {
    // Storage blocked: the URL alone still says who, for this page.
    return known(asked) ? asked : null;
  }
}

/** Back to the device's own learner. Whatever was practised as the synthetic learner is dropped with it. */
export function clearViewAs(): void {
  try {
    sessionStorage.removeItem(VIEW_AS_KEY);
    sessionStorage.removeItem(SYNTHETIC_KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

/** Exit loads /learn afresh rather than routing there, so every page reads the learner again. */
export function exitViewAs(): void {
  clearViewAs();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/learn');
}
