'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { actionFor, byId, demoGoal, rootRelationships, stateOf, type Domain, type GraphAction } from './data';
import { layoutGraph, neighbor } from './layout';
import { branchCurve, curve, mapSize, overviewCamera, placeLabels, presentation, projectGraph, viewPoints } from './projection';
import styles from './graph.module.css';
import { GraphCompanion, type CompanionControl } from './GraphCompanion';
import type { preparedActivity } from './prepared';

export type MasteryGraphHomeProps = { onAction: (action: GraphAction) => void; actionLabel: (action: GraphAction) => string; guide: CompanionControl & { activity: typeof preparedActivity; actionLabel: string; complete: boolean; onStart: () => void } };
const masteryWords = { mastered: 'Established', developing: 'Developing', unknown: 'Unknown' };
const relationships = rootRelationships;

export function MasteryGraphHome({ onAction, actionLabel, guide }: MasteryGraphHomeProps) {
  const [exploring, setExploring] = useState(false);
  const recoverButton = useRef<HTMLButtonElement>(null), exploreMenu = useRef<HTMLDetailsElement>(null);
  const [domain, setDomain] = useState<Domain>('theory');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null), stage = useRef<HTMLDivElement>(null), uid = useId();
  const [viewport, setViewport] = useState({ ...mapSize });
  const [camera, setCamera] = useState(overviewCamera);
  const drag = useRef<{x:number;y:number;camera:typeof camera;moved:boolean;skillId:string|null} | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const world = useMemo(() => layoutGraph(domain, relationships), [domain]);
  const projected = useMemo(() => projectGraph(world, viewport.width, viewport.height), [world, viewport]);
  const points = viewPoints(projected, camera, viewport.width, viewport.height);
  const pointById = new Map(points.map(point => [point.node.id, point]));
  const { visible, preview } = presentation(points, selectedId, viewport.width, viewport.height);
  const showCompanion = !exploring && !guide.collapsed && !selectedId && camera.scale === 1 && camera.x === 0 && camera.y === 0;
  const recommendedId = showCompanion && domain === guide.activity.domain ? guide.activity.skillId : undefined;
  const labels = placeLabels(points, visible, preview, selectedId, hover ?? recommendedId ?? null, camera.scale, viewport.width, viewport.height);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedPoint = selectedId ? pointById.get(selectedId) : undefined;
  const policy = selected ? actionFor(selected) : undefined;
  const status = selected ? stateOf(selected.id) : undefined;
  const backbone = relationships.filter(edge => pointById.has(edge.from) && pointById.has(edge.to));
  function select(id: string) {
    const node = byId.get(id); if (!node) return;
    setExploring(true); setDomain(node.domain); setSelectedId(id);
  }
  function switchDomain(next: Domain) { setExploring(true); setDomain(next); setSelectedId(null); setHover(null); setCamera(overviewCamera); }
  function recover() {
    setExploring(false); guide.onCollapsedChange(false); setDomain(guide.activity.domain);
    setSelectedId(null); setHover(null); setCamera(overviewCamera);
    if (exploreMenu.current) exploreMenu.current.open = false;
    requestAnimationFrame(() => stage.current?.querySelector<HTMLButtonElement>('aside[aria-label="Your next activity"] button')?.focus());
  }
  function dismissGuide() {
    guide.onCollapsedChange(true);
    requestAnimationFrame(() => recoverButton.current?.focus());
  }
  function move(from: string, key: string) {
    const id = neighbor(world, from, key); select(id);
    requestAnimationFrame(() => svg.current?.querySelector<SVGElement>(`[data-skill="${id}"]`)?.focus());
  }
  function close() { setSelectedId(null); setCamera(overviewCamera); svg.current?.focus(); }
  function fit() { close(); setCamera(overviewCamera); }
  function zoom(factor: number) { setExploring(true); setCamera(current => ({...current,scale:Math.max(1,Math.min(4,current.scale*factor))})); }
  function focusGroup(id: string) {
    const ids = new Set([id]); let grew = true;
    while (grew) { grew = false; for (const point of projected) if (point.node.parentId && ids.has(point.node.parentId) && !ids.has(point.node.id)) { ids.add(point.node.id); grew = true; } }
    const group = projected.filter(point => ids.has(point.node.id));
    const minX=Math.min(...group.map(p=>p.screenX)),maxX=Math.max(...group.map(p=>p.screenX)),minY=Math.min(...group.map(p=>p.screenY)),maxY=Math.max(...group.map(p=>p.screenY));
    const scale=Math.min(4,Math.max(1,Math.min((viewport.width-300)/Math.max(1,maxX-minX),(viewport.height-100)/Math.max(1,maxY-minY))));
    setCamera({scale,x:-((minX+maxX)/2-viewport.width/2)*scale,y:-((minY+maxY)/2-viewport.height/2)*scale});
  }
  return <section className={styles.home} aria-labelledby={`${uid}-title`}>
    <div className={styles.toolbar}>
      <h1 id={`${uid}-title`}>Learning map</h1>
      {!showCompanion && <button ref={recoverButton} type="button" className={styles.recover} onClick={recover}>Your next activity <span aria-hidden="true">↗</span></button>}
      <details ref={exploreMenu} className={styles.exploreMenu} onToggle={event => { if (event.currentTarget.open) setExploring(true); }}><summary>Explore map</summary><div className={styles.tabs} role="tablist" aria-label="Skill domain">{(['theory', 'procedure'] as const).map(part => <button type="button" role="tab" key={part} aria-selected={domain === part} aria-controls={`${uid}-map`} id={`${uid}-${part}`} tabIndex={domain === part ? 0 : -1} onClick={() => switchDomain(part)} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = part === 'theory' ? 'procedure' : 'theory'; switchDomain(next); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="${uid}-${next}"]`)?.focus(); }
      }}>{part === 'theory' ? 'Theory' : 'Procedure'}</button>)}</div></details>
      <div className={styles.legend} aria-label="Learner state legend"><span><i data-state="mastered"/>Established</span><span><i data-state="developing"/>Developing</span><span><i data-state="unknown"/>Unknown</span><span><i className={styles.dueKey}/>Review due</span></div>
      <span className={styles.demo}>Demo learner</span>
    </div>
    <div ref={stage} className={styles.mapStage} role="tabpanel" id={`${uid}-map`} aria-labelledby={`${uid}-${domain}`}>
      <svg ref={svg} className={styles.map} viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="group" tabIndex={0} aria-label={`${domain === 'theory' ? 'Theory' : 'Procedure'} skill map. Select a node to explore.`} onClick={event => { if (suppressClick.current) { suppressClick.current=false; return; } if (event.target === event.currentTarget) close(); }}
        onPointerDown={event => { if(event.button!==0)return; drag.current={x:event.clientX,y:event.clientY,camera,moved:false,skillId:(event.target as Element).closest("[data-skill]")?.getAttribute("data-skill")??null}; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const start=drag.current;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.hypot(dx,dy)>4){start.moved=true;setExploring(true);setCamera({...start.camera,x:start.camera.x+dx,y:start.camera.y+dy});} }}
        onPointerUp={event => { const start=drag.current;suppressClick.current=!!start&&(start.moved||!!start.skillId);if(start&&!start.moved&&start.skillId)select(start.skillId);drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => {drag.current=null;}}
        onKeyDown={event => { if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='0'){event.preventDefault();fit();}if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.25);}if(event.key==='-'){event.preventDefault();zoom(.8);}if(event.target===event.currentTarget&&event.key.startsWith('Arrow')){event.preventDefault();setExploring(true);setCamera(c=>({...c,x:c.x+(event.key==='ArrowLeft'?40:event.key==='ArrowRight'?-40:0),y:c.y+(event.key==='ArrowUp'?40:event.key==='ArrowDown'?-40:0)}));} }}>
        <defs><marker id={`${uid}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7Z" className={styles.arrowhead}/></marker></defs>
        <g aria-hidden="true" pointerEvents="none">
          {points.map(point => {
            const parent = point.node.parentId ? pointById.get(point.node.parentId) : null;
            return parent && visible.has(point.node.id) && visible.has(parent.node.id) && <path key={`parent-${point.node.id}`} className={styles.branch} d={branchCurve(parent, point)} data-preview={preview.has(point.node.id)} data-active={point.node.id === selectedId || parent.node.id === selectedId}/>;
          })}
          {backbone.map(edge => <path key={`${edge.from}-${edge.to}`} className={styles.backbone} d={curve(pointById.get(edge.from)!, pointById.get(edge.to)!, backbone.some(other => other.from === edge.to && other.to === edge.from))} markerEnd={`url(#${uid}-arrow)`}><title>{edge.label}</title></path>)}
          {selected && selected.prerequisites.map(id => { const from = pointById.get(id), to = selectedPoint; return from && to && <path key={id} className={styles.prerequisite} d={curve(from, to)} markerEnd={`url(#${uid}-arrow)`}/>; })}
        </g>
        {points.filter(point => visible.has(point.node.id)).map(point => {
          const group = point.depth === 0, chosen = point.node.id === selectedId, learner = stateOf(point.node.id);
          const radius = group ? 9 : point.depth === 1 ? 4.5 : 2.8;

          return <g key={point.node.id} role="button" tabIndex={chosen || !selectedId && point === points[0] ? 0 : -1} data-skill={point.node.id} aria-label={`${point.node.title}, ${group ? 'skill group' : masteryWords[learner.mastery]}${learner.due ? ', review due' : ''}${point.node.id === recommendedId ? ', suggested next' : ''}`} aria-pressed={chosen} className={styles.node} data-state={group ? 'group' : learner.mastery} data-preview={preview.has(point.node.id)} data-selected={chosen} data-recommended={point.node.id === recommendedId} onClick={event => {event.stopPropagation();if(!suppressClick.current)select(point.node.id);suppressClick.current=false;}} onMouseEnter={() => setHover(point.node.id)} onMouseLeave={() => setHover(null)} onKeyDown={event => {
            if (event.key.startsWith('Arrow')) { event.preventDefault(); event.stopPropagation(); move(point.node.id, event.key); }
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(point.node.id); }
            if (event.key === 'Escape') { event.preventDefault(); close(); }
          }}>
            <title>{point.node.title}</title><circle cx={point.screenX} cy={point.screenY} r="15" className={styles.hit}/>
            {point.node.id === recommendedId && <circle cx={point.screenX} cy={point.screenY} r={radius + 7} className={styles.recommended}/>}
            {chosen && <circle cx={point.screenX} cy={point.screenY} r={radius + 6} className={styles.selection}/>}
            <circle cx={point.screenX} cy={point.screenY} r={radius} className={styles.dot}/>
            {!group && learner.due && <circle cx={point.screenX + radius + 2} cy={point.screenY - radius - 2} r="2.8" className={styles.due}/>}
          </g>;
        })}
        {labels.map(label => <g key={`label-${label.id}`} pointerEvents="none"><rect className={styles.labelClearance} x={label.x} y={label.y} width={label.width} height={label.height}/><text x={label.x+label.width/2} y={label.y+label.height-6} textAnchor="middle" className={label.root?styles.groupLabel:styles.nodeLabel}>{label.text}</text></g>)}
      </svg>
      {showCompanion && <GraphCompanion title={guide.activity.title} reason={guide.activity.reason} actionLabel={guide.actionLabel} complete={guide.complete} onStart={guide.onStart} onDismiss={dismissGuide}/>}
      {exploring && <div className={styles.cameraControls} aria-label="Map view"><button type="button" aria-label="Zoom out" disabled={camera.scale<=1} onClick={()=>zoom(.8)}>−</button><output aria-label="Map zoom">{Math.round(camera.scale*100)}%</output><button type="button" aria-label="Zoom in" disabled={camera.scale>=4} onClick={()=>zoom(1.25)}>+</button><button type="button" onClick={fit}>Fit map</button></div>}
      {selected && status && policy && <aside className={styles.inspector} aria-label="Selected skill" data-side={selectedPoint && selectedPoint.screenX > viewport.width * .58 ? 'left' : 'right'}>
        <header><h2>{selected.title}</h2><button type="button" onClick={close} aria-label="Close skill details"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></header>
        <div className={styles.detail} aria-live="polite">
          <p className={styles.state} data-state={!selected.parentId ? 'group' : status.mastery}>{!selected.parentId ? 'Skill group' : masteryWords[status.mastery]}{selected.parentId && status.due && <span> · Review due</span>}</p>
          <p>{selected.description}</p>{!selected.parentId&&<button type="button" className={styles.focusGroup} onClick={()=>focusGroup(selected.id)}>Focus this group</button>}<p className={styles.reason}>{policy.reason}</p>
          {selected.prerequisites.length > 0 && <div className={styles.foundations}><h3>Builds on</h3>{selected.prerequisites.map(id => <button key={id} type="button" onClick={() => select(id)}><span>{byId.get(id)!.title}</span><small>{masteryWords[stateOf(id).mastery]}</small></button>)}</div>}
          {points.some(point => point.node.parentId === selected.id) && <div className={styles.foundations}><h3>Explore skills</h3>{points.filter(point => point.node.parentId === selected.id).map(point => <button key={point.node.id} type="button" onClick={event => {event.stopPropagation();if(!suppressClick.current)select(point.node.id);suppressClick.current=false;}}>{point.node.title}</button>)}</div>}
        </div>
        {policy.action && <div className={styles.action}><p>{selected.activity}</p><button type="button" onClick={() => onAction(policy.action!)}>{actionLabel(policy.action)}<span aria-hidden="true">→</span></button></div>}
      </aside>}
    </div>
    <div className={styles.mapFoot}><span>Goal: {demoGoal.title}</span><span>Drag to move · + / − zoom · Arrow keys explore</span><details><summary>About this map</summary><p>Illustrative foundations, fictional learner states and a sample goal. This is not an assessment or a complete validated curriculum. Broad curves express subject relationships; local branches express grouping. Prerequisites appear only for the selected skill. Faint points preview deeper levels, not weaker mastery.</p></details></div>
  </section>;
}
