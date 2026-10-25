import { buildCohort, type SyntheticLearner } from '../../../learn/frontend/mastery/sim';
import { Cohort } from './Cohort';

export const metadata = { title: 'Synthetic cohort' };
// The cohort is seeded, so the page is the same on every request: built once, at build time.
export const dynamic = 'force-static';

let cohort: readonly SyntheticLearner[] | null = null;
export default function Page() {
  cohort ??= buildCohort();
  return <Cohort cohort={cohort}/>;
}
