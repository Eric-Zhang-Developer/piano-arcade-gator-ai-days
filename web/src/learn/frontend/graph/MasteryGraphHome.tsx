'use client';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { kitButton, kitChip } from '../../../game/duo-tokens';
import { DuoScope } from '../duo';
import { curriculum } from '../mastery/curriculum';
import { deviceStore } from '../mastery/engine';
import type { Attempt, Colour, Goals } from '../mastery/schema';
import { layoutCurriculum } from './layout';
import { anchorLabels, followLabels, type AnchoredLabel, branchCurve, curve, mapSize, overviewCamera, placeLabels, presentation, projectGraph, viewPoints } from './projection';
import { activityHref, activityLabel, fetchNext, learnerId, maxGoals, noGoals, paint, shortTitle, tally, toggleGoal, type NextResult } from './student';
import { GraphCompanion } from './GraphCompanion';
import { useGuidedEntry } from './GuidedEntry';
import type { PreparedActivity } from './prepared';
import styles from './graph.module.css';
export type MasteryGraphHomeProps = { guide: { activity: PreparedActivity; href: string; actionLabel: string; complete: boolean; onStart: () => void } };
const colourWords: Record<Colour, string> = { unknown: 'Not yet', 'in-progress': 'In progress', mastered: 'Mastered' };
const legend: readonly Colour[] = ['unknown', 'in-progress', 'mastered'];
const titles = new Map(curriculum.nodes.map(node => [node.id, node.title]));
type Loaded = { attempts: readonly Attempt[]; goals: Goals };
/** How far the graph sits below centre when there is room, so it clears the companion in the top-left corner. */
const companionLift = 120;
/** Painted dots draw larger than unknown ones so the student's own progress reads at the overview zoom. */
const dotRadius = (depth: number, painted: boolean) => depth === 0 ? 9 : depth === 1 ? (painted ? 5.5 : 4.5) : painted ? 4 : 2.8;
/** The student's own graph: the built curriculum, painted from their attempts, with their goal songs and the planner's next step. */
export function MasteryGraphHome({ guide }: MasteryGraphHomeProps) {
  const { active, begin } = useGuidedEntry();
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null), uid = useId();
  const [viewport, setViewport] = useState({ ...mapSize });
  const [flightCaptions, setFlightCaptions] = useState<AnchoredLabel[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [goalsSaved, setGoalsSaved] = useState(true);
  const [answer, setAnswer] = useState<{ for: Loaded; result: NextResult } | null>(null);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all([deviceStore.list(learnerId), deviceStore.getGoals(learnerId)])
      .then(([attempts, goals]) => { if (live) setLoaded({ attempts, goals }); })
      .catch(() => { if (live) setLoaded({ attempts: [], goals: noGoals }); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const controller = new AbortController();
    fetchNext(fetch, { attempts: [...loaded.attempts], goals: loaded.goals }, curriculum, controller.signal).then(result => { if (!controller.signal.aborted) setAnswer({ for: loaded, result }); });
    return () => controller.abort();
  }, [loaded]);
  const world = useMemo(() => layoutCurriculum(curriculum), []);
  const colours = useMemo(() => paint(curriculum, loaded?.attempts ?? []), [loaded]);
  const counts = tally(colours);
  const next = answer && answer.for === loaded ? answer.result : null;
  const session = next?.ok ? next.session : null;
  const first = session?.activities[0] ?? null;
  const recommendedId = first?.nodeId ?? null;
  const painted = useMemo(() => new Set([...colours].filter(([, colour]) => colour !== 'unknown').map(([id]) => id)), [colours]);
  const priority = useMemo(() => new Set([...painted, ...session?.activities.map(item => item.nodeId) ?? []]), [painted, session]);
  const projected = useMemo(() => projectGraph(world.points, viewport.width, viewport.height, companionLift), [world, viewport]);
  const camera = active?.frame.camera ?? overviewCamera;
  const points = viewPoints(projected, camera, viewport.width, viewport.height);
  const pointById = new Map(points.map(point => [point.node.id, point]));
  const { visible, preview } = presentation(points, recommendedId, viewport.width, viewport.height, priority);
  const restingLabels = useMemo(() => {
    const overview = presentation(projected, recommendedId, viewport.width, viewport.height, priority);
    return placeLabels(projected, overview.visible, overview.preview, null, recommendedId, 1, viewport.width, viewport.height, painted);
  }, [projected, recommendedId, viewport, priority, painted]);
  const labels = active ? followLabels(flightCaptions, points) : restingLabels;
  const backbone = world.relationships.filter(edge => pointById.has(edge.from) && pointById.has(edge.to));
  function chooseGoal(songId: string) {
    if (!loaded) return;
    const previous = loaded.goals, goals = { songIds: [...toggleGoal(previous.songIds, songId)] };
    setLoaded({ ...loaded, goals });
    deviceStore.setGoals(learnerId, goals).then(saved => {
      setGoalsSaved(saved);
      if (!saved) setLoaded(current => current && { ...current, goals: previous });
    });
  }
  function enterActivity(event: MouseEvent<HTMLButtonElement>) {
    if (!first) return guide.onStart();
    const element = stage.current, pet = element?.querySelector<HTMLImageElement>('[data-gator-perch]');
    const target = projected.find(point => point.node.id === first.nodeId);
    const href = activityHref(first);
    if (!element || !pet || !target || active) return;
    const bounds = element.getBoundingClientRect(), source = pet.getBoundingClientRect();
    setFlightCaptions(anchorLabels(restingLabels, projected));
    if (!begin({ source: {x:source.left+source.width/2-bounds.left,y:source.top+source.height/2-bounds.top}, target:{x:target.screenX,y:target.screenY}, bounds:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}, href:href.split('?')[0],title:titles.get(first.nodeId) ?? first.nodeId }, event.timeStamp, () => router.push(href))) router.push(href);
  }
  const songs = curriculum.songs, chosen = loaded?.goals.songIds ?? [];
  return <DuoScope className={styles.home} aria-busy={!!active || !loaded} aria-labelledby={`${uid}-title`}>
    <div className={styles.toolbar}>
      <h1 id={`${uid}-title`}>Your map</h1>
      <ul className={styles.legend} aria-label="Map colours">{legend.map(colour => <li key={colour} data-state={colour}><span className={styles.swatch} aria-hidden="true"/>{colourWords[colour]}<span className={styles.count}>{loaded ? counts[colour] : '-'}</span></li>)}</ul>
    </div>
    <div className={styles.body}>
      <div ref={stage} className={styles.mapStage} data-entering={!!active} data-camera-scale={camera.scale} data-camera-x={camera.x} data-camera-y={camera.y}>
        <svg className={styles.map} viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="group" aria-label={`Your learning map: ${counts.mastered} mastered, ${counts['in-progress']} in progress, ${counts.unknown} not yet.`}>
          <defs><marker id={`${uid}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7Z" className={styles.arrowhead}/></marker></defs>
          <g aria-hidden="true">{points.map(point => {
            const parent = point.node.parentId ? pointById.get(point.node.parentId) : null;
            return parent && visible.has(point.node.id) && visible.has(parent.node.id) && <path key={`parent-${point.node.id}`} className={styles.branch} d={branchCurve(parent, point)} data-preview={preview.has(point.node.id)}/>;
          })}{backbone.map(edge => <path key={`${edge.from}-${edge.to}`} className={styles.backbone} d={curve(pointById.get(edge.from)!, pointById.get(edge.to)!, backbone.some(other => other.from === edge.to && other.to === edge.from))} markerEnd={`url(#${uid}-arrow)`}/>)}</g>
          {points.filter(point => visible.has(point.node.id)).map(point => {
            const root = point.depth === 0, colour = colours.get(point.node.id) ?? 'unknown', radius = dotRadius(point.depth, painted.has(point.node.id));
            return <g key={point.node.id} role="img" data-skill={point.node.id} aria-label={`${point.node.title}, ${root ? 'region' : colourWords[colour]}${point.node.id === recommendedId ? ', next activity' : ''}`} className={styles.node} data-state={root ? 'root' : colour} data-preview={preview.has(point.node.id)}>
              <title>{point.node.title}</title>{point.node.id === recommendedId && <circle cx={point.screenX} cy={point.screenY} r={radius+7} className={styles.recommended}/>}
              <circle cx={point.screenX} cy={point.screenY} r={radius} className={styles.dot}/>
            </g>;
          })}
          {labels.map(label => <g key={`label-${label.id}`} className={styles.caption} data-label-id={label.id} data-target={label.id === recommendedId} pointerEvents="none"><rect className={styles.labelClearance} x={label.x} y={label.y} width={label.width} height={label.height}/><text x={label.x+label.width/2} y={label.y+label.height-6} textAnchor="middle" className={label.root?styles.groupLabel:styles.nodeLabel}>{label.text}</text></g>)}
        </svg>
        {first
          ? <GraphCompanion eyebrow={`Next: ${activityLabel(first.activity)}`} title={shortTitle(titles.get(first.nodeId) ?? first.nodeId)} reason={first.reason} actionLabel={activityLabel(first.activity)} complete={false} entering={!!active} onStart={enterActivity}/>
          : <GraphCompanion title={guide.activity.title} reason={guide.activity.reason} actionLabel={guide.actionLabel} complete={guide.complete} entering={!!active} onStart={enterActivity}/>}
      </div>
      <aside className={styles.rail} aria-label="Goals and next steps">
        <section aria-labelledby={`${uid}-goals`}>
          <h2 id={`${uid}-goals`}>Goal songs</h2>
          <p className={styles.hint}>Pick up to {maxGoals}. Next plans toward them.</p>
          {songs.length
            ? <ul className={styles.songs}>{songs.map(song => {
              const lit = chosen.includes(song.songId), full = !lit && chosen.length >= maxGoals, chip = kitChip(lit);
              return <li key={song.songId}><button type="button" className={chip.className} style={{ ...chip.style, fontSize: 16 }} aria-pressed={lit} disabled={!loaded || full} onClick={() => chooseGoal(song.songId)}>{song.songId}</button></li>;
            })}</ul>
            : <p className={styles.empty}>No songs are tagged in the curriculum yet.</p>}
          {!goalsSaved && <p className={styles.error} role="alert">Your goals could not be saved on this device.</p>}
        </section>
        <section aria-labelledby={`${uid}-next`} aria-live="polite">
          <h2 id={`${uid}-next`}>Next</h2>
          {!next
            ? <p className={styles.hint}>Asking the planner…</p>
            : session
              ? <ol className={styles.plan}>{session.activities.map((item, index) => <li key={`${item.nodeId}-${item.activity}-${index}`}>
                <span className={styles.planKind}>{activityLabel(item.activity)}</span>
                <strong>{shortTitle(titles.get(item.nodeId) ?? item.nodeId)}</strong>
                <p>{item.reason}</p>
                <a {...kitButton('secondary')} style={{ ...kitButton('secondary').style, fontSize: 16 }} href={activityHref(item)}>Open {activityLabel(item.activity)}</a>
              </li>)}</ol>
              : <p className={styles.empty}>Next isn&apos;t connected. The planner did not answer, so there is no plan to show.</p>}
        </section>
      </aside>
    </div>
  </DuoScope>;
}
