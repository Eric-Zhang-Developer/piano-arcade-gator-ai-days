'use client';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { demoGoal, rootRelationships, stateOf } from './data';
import { layoutGraph } from './layout';
import { anchorLabels, followLabels, type AnchoredLabel, branchCurve, curve, mapSize, overviewCamera, placeLabels, presentation, projectGraph, viewPoints } from './projection';
import { GraphCompanion } from './GraphCompanion';
import { useGuidedEntry } from './GuidedEntry';
import type { PreparedActivity } from './prepared';
import styles from './graph.module.css';
export type MasteryGraphHomeProps = { guide: { activity: PreparedActivity; href: string; actionLabel: string; complete: boolean; onStart: () => void } };
const masteryWords = { mastered: 'Secure', developing: 'Partial', unknown: 'Low' };
const sourceWords = { fictional: 'fictional example', prior: 'demo prior' };
export function MasteryGraphHome({ guide }: MasteryGraphHomeProps) {
  const { active, begin } = useGuidedEntry();
  const stage = useRef<HTMLDivElement>(null), uid = useId();
  const [viewport, setViewport] = useState({ ...mapSize });
  const [flightCaptions, setFlightCaptions] = useState<AnchoredLabel[]>([]);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const world = useMemo(() => layoutGraph(guide.activity.domain, rootRelationships), [guide.activity.domain]);
  const projected = useMemo(() => projectGraph(world, viewport.width, viewport.height), [world, viewport]);
  const camera = active?.frame.camera ?? overviewCamera;
  const points = viewPoints(projected, camera, viewport.width, viewport.height);
  const pointById = new Map(points.map(point => [point.node.id, point]));
  const { visible, preview } = presentation(points, null, viewport.width, viewport.height);
  const recommendedId = guide.activity.skillId;
  const restingLabels = useMemo(() => {
    const overview = presentation(projected, null, viewport.width, viewport.height);
    return placeLabels(projected, overview.visible, overview.preview, null, recommendedId, 1, viewport.width, viewport.height);
  }, [projected, recommendedId, viewport]);
  const labels = active ? followLabels(flightCaptions, points) : restingLabels;
  const backbone = rootRelationships.filter(edge => pointById.has(edge.from) && pointById.has(edge.to));
  function enterActivity(event: MouseEvent<HTMLButtonElement>) {
    const element = stage.current, pet = element?.querySelector<HTMLImageElement>('[data-gator-perch]');
    const target = projected.find(point => point.node.id === recommendedId);
    if (!element || !pet || !target || active) return;
    const bounds = element.getBoundingClientRect(), source = pet.getBoundingClientRect();
    setFlightCaptions(anchorLabels(restingLabels, projected));
    begin({ source: {x:source.left+source.width/2-bounds.left,y:source.top+source.height/2-bounds.top}, target:{x:target.screenX,y:target.screenY}, bounds:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}, href:guide.href,title:guide.activity.title }, event.timeStamp, guide.onStart);
  }
  return <section className={styles.home} aria-busy={!!active} aria-labelledby={`${uid}-title`}>
    <div className={styles.toolbar}><h1 id={`${uid}-title`}>Learning map</h1><span className={styles.demo}>Demo learner</span></div>
    <div ref={stage} className={styles.mapStage} data-entering={!!active} data-camera-scale={camera.scale} data-camera-x={camera.x} data-camera-y={camera.y}>
      <svg className={styles.map} viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="group" aria-label={`${guide.activity.domain === 'theory' ? 'Theory' : 'Procedure'} learning map. Your gator will guide you to the prepared activity.`}>
        <defs><marker id={`${uid}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7Z" className={styles.arrowhead}/></marker></defs>
        <g aria-hidden="true">{points.map(point => {
          const parent = point.node.parentId ? pointById.get(point.node.parentId) : null;
          return parent && visible.has(point.node.id) && visible.has(parent.node.id) && <path key={`parent-${point.node.id}`} className={styles.branch} d={branchCurve(parent, point)} data-preview={preview.has(point.node.id)}/>;
        })}{backbone.map(edge => <path key={`${edge.from}-${edge.to}`} className={styles.backbone} d={curve(pointById.get(edge.from)!, pointById.get(edge.to)!, backbone.some(other => other.from === edge.to && other.to === edge.from))} markerEnd={`url(#${uid}-arrow)`}/>)}</g>
        {points.filter(point => visible.has(point.node.id)).map(point => {
          const group = point.depth === 0, learner = stateOf(point.node.id), radius = group ? 9 : point.depth === 1 ? 4.5 : 2.8;
          return <g key={point.node.id} role="img" data-skill={point.node.id} aria-label={`${point.node.title}, ${group ? 'skill group, ' : ''}${masteryWords[learner.displayMastery]}, ${sourceWords[learner.distributionSource]}${point.node.id === recommendedId ? ', next activity' : ''}`} className={styles.node} data-state={learner.displayMastery} data-preview={preview.has(point.node.id)}>
            <title>{point.node.title}</title>{point.node.id === recommendedId && <circle cx={point.screenX} cy={point.screenY} r={radius+7} className={styles.recommended}/>}
            <circle cx={point.screenX} cy={point.screenY} r={radius} className={styles.dot}/>
          </g>;
        })}
        {labels.map(label => <g key={`label-${label.id}`} className={styles.caption} data-label-id={label.id} data-target={label.id === recommendedId} pointerEvents="none"><rect className={styles.labelClearance} x={label.x} y={label.y} width={label.width} height={label.height}/><text x={label.x+label.width/2} y={label.y+label.height-6} textAnchor="middle" className={label.root?styles.groupLabel:styles.nodeLabel}>{label.text}</text></g>)}
      </svg>
      <GraphCompanion title={guide.activity.title} reason={guide.activity.reason} actionLabel={guide.actionLabel} complete={guide.complete} entering={!!active} onStart={enterActivity}/>
    </div>
    <div className={styles.mapFoot}><span>Goal: {demoGoal.title}</span><details><summary>About this map</summary><p>Illustrative foundations, fictional learner states and a sample goal. This is not an assessment or a complete validated curriculum. The gator guides the prepared activity; the map is not a free exploration view.</p></details></div>
  </section>;
}
