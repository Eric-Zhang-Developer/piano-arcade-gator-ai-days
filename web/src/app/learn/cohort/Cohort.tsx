import { DuoScope } from '../../../learn/frontend/duo';
import { songTitle } from '../../../learn/frontend/graph/song-titles';
import { activityLabel, shortTitle } from '../../../learn/frontend/graph/student';
import { curriculum } from '../../../learn/frontend/mastery/curriculum';
import { pathOf, SIM_STEPS, type SyntheticLearner } from '../../../learn/frontend/mastery/sim';
import styles from './cohort.module.css';

const titles = new Map(curriculum.nodes.map(node => [node.id, shortTitle(node.title)]));
const inputs = { midi: 'MIDI piano', keyboard: 'Laptop keys' } as const;

/** The first three steps, a step repeated in a row shown once with its count. */
function runs(learner: SyntheticLearner): { step: SyntheticLearner['steps'][number]; count: number }[] {
  const out: { step: SyntheticLearner['steps'][number]; count: number }[] = [];
  for (const step of learner.steps.slice(0, 3)) {
    const last = out.at(-1);
    if (last && last.step.nodeId === step.nodeId && last.step.activity === step.activity) last.count++;
    else out.push({ step, count: 1 });
  }
  return out;
}

/** The cohort as a table: where each learner started, the planner's first three steps, and what they mastered. */
export function Cohort({ cohort }: { cohort: readonly SyntheticLearner[] }) {
  const openings = new Set(cohort.map(l => pathOf(l))).size;
  const paths = new Set(cohort.map(l => pathOf(l, SIM_STEPS))).size;
  const nodes = curriculum.nodes.length;
  return <DuoScope className={styles.cohort}>
    <div className={styles.column}>
      <header className={styles.head}>
        <h1>Synthetic cohort</h1>
        <p className={styles.label}>{cohort.length} synthetic learners, not real students.</p>
        <p className={styles.note}>Each starts from its own goals, input and hidden prior knowledge, takes the diagnostic, then {SIM_STEPS} activities chosen by the planner&rsquo;s fallback through the same engine.</p>
      </header>
      <dl className={styles.counts}>
        <div><dt>Learners</dt><dd>{cohort.length}</dd></div>
        <div><dt>Different first three steps</dt><dd>{openings}</dd></div>
        <div><dt>Different paths over {SIM_STEPS} steps</dt><dd>{paths}</dd></div>
      </dl>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Learner</th>
              <th scope="col">Starting level</th>
              <th scope="col">Input</th>
              <th scope="col">Goals</th>
              <th scope="col">First three steps</th>
              <th scope="col" className={styles.number}>Mastered after {SIM_STEPS}</th>
              <th scope="col"><span className={styles.srOnly}>View</span></th>
            </tr>
          </thead>
          <tbody>
            {cohort.map(learner => <tr key={learner.id}>
              <th scope="row" className={styles.id}>{learner.id}</th>
              <td className={styles.level}>{learner.startingLevel}</td>
              <td className={styles.input}>{inputs[learner.input]}</td>
              <td className={styles.goals}>{learner.goals.songIds.length ? learner.goals.songIds.map(songTitle).join(', ') : <span className={styles.none}>None</span>}</td>
              <td>
                <ol className={styles.steps} aria-label="First three steps">
                  {runs(learner).map(({ step, count }, i) => <li key={i}>
                    {activityLabel(step.activity)} <span className={styles.node}>{titles.get(step.nodeId) ?? step.nodeId}</span>
                    {count > 1 && <span className={styles.times}> &times;{count}</span>}
                  </li>)}
                </ol>
              </td>
              <td className={styles.number}>{learner.mastered} of {nodes}</td>
              <td><a className={styles.view} href={`/learn?as=${learner.id}`} aria-label={`View as ${learner.id}`}>View as</a></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </DuoScope>;
}
