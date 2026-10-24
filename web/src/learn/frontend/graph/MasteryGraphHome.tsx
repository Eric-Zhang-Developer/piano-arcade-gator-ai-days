'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { actionFor, byId, demoGoal, recommendation, stateOf, type Domain, type GraphAction } from './data';
import { layoutGraph, mapSize, neighbor } from './layout';
import styles from './graph.module.css';

export type MasteryGraphHomeProps = { onAction: (action: GraphAction) => void };
const masteryWords = { mastered: 'Established', developing: 'Developing', unknown: 'Unknown' };

export function MasteryGraphHome({ onAction }: MasteryGraphHomeProps) {
  const [domain, setDomain] = useState<Domain>('theory');
  const [selection, setSelection] = useState<Record<Domain, string>>({ theory: recommendation('theory')!.id, procedure: recommendation('procedure')!.id });
  const [hover, setHover] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const uid = useId();
  const points = useMemo(() => layoutGraph(domain), [domain]);
  const selected = byId.get(selection[domain])!;
  const policy = actionFor(selected);
  const status = stateOf(selected.id);
  const isGroup = !selected.parentId;
  const pointById = new Map(points.map((p) => [p.node.id, p]));
  function select(id: string) {
    const node = byId.get(id); if (!node) return;
    setDomain(node.domain); setSelection((old) => ({ ...old, [node.domain]: id }));
  }
  function move(key: string) {
    const id = neighbor(points, selected.id, key);
    select(id);
    svg.current?.querySelector<SVGElement>(`[data-skill="${id}"]`)?.focus();
  }
  return <section className={styles.home} aria-labelledby={`${uid}-title`}>
    <header className={styles.header}>
      <div><h1 id={`${uid}-title`}>Your learning map</h1><p>Goal: {demoGoal.title}</p></div>
      <span className={styles.demo}>Demo learner · foundations slice</span>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label="Skill domain">
        {(['theory', 'procedure'] as const).map((part) => <button type="button" key={part} role="tab" id={`${uid}-${part}`} aria-controls={`${uid}-map`} aria-selected={domain === part} tabIndex={domain === part ? 0 : -1} onClick={() => setDomain(part)} onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setDomain(part === 'theory' ? 'procedure' : 'theory'); (e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[id="${uid}-${part === 'theory' ? 'procedure' : 'theory'}"]`))?.focus(); }
        }}>{part === 'theory' ? 'Theory' : 'Procedure'}</button>)}
      </div>
      <div className={styles.legend} aria-label="Learner state legend"><span><i data-state="mastered" />Established</span><span><i data-state="developing" />Developing</span><span><i data-state="unknown" />Unknown</span><span><i className={styles.dueKey} />Review due</span></div>
    </div>
    <div className={styles.body}>
      <div className={styles.mapPane} role="tabpanel" id={`${uid}-map`} aria-labelledby={`${uid}-${domain}`}>
        <svg ref={svg} className={styles.map} viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} aria-label={`${domain === 'theory' ? 'Theory' : 'Procedure'} skill map. Select a node; use arrow keys to move between skills.`}>
          <defs><marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L7 4 L1 7" fill="none" stroke="currentColor" strokeWidth="1.2" /></marker></defs>
          <g aria-hidden="true">
            {points.map((p) => {
              const parent = p.node.parentId ? pointById.get(p.node.parentId) : null;
              return parent && <line key={`parent-${p.node.id}`} className={styles.branch} x1={parent.x} y1={parent.y} x2={p.x} y2={p.y} data-active={p.node.id === selected.id || parent.node.id === selected.id} />;
            })}
            {points.flatMap((p) => p.node.prerequisites.map((id) => {
              const from = pointById.get(id); if (!from) return null;
              return <path key={`${id}-${p.node.id}`} className={styles.prerequisite} d={`M${from.x},${from.y} Q${(from.x + p.x) / 2},${(from.y + p.y) / 2 - 45} ${p.x},${p.y}`} markerEnd={`url(#${uid}-arrow)`} data-active={p.node.id === selected.id || id === selected.id} />;
            }))}
          </g>
          {points.map((p) => {
            const group = p.depth === 0, chosen = p.node.id === selected.id, showLabel = group || chosen || hover === p.node.id;
            const learner = stateOf(p.node.id);
            const radius = group ? 19 : p.depth === 1 ? 10 : 7;
            return <g key={p.node.id} role="button" tabIndex={chosen ? 0 : -1} data-skill={p.node.id} aria-label={`${p.node.title}, ${group ? 'skill group' : masteryWords[learner.mastery]}${learner.due ? ', review due' : ''}`} aria-pressed={chosen} className={styles.node} data-state={group ? 'group' : learner.mastery} data-selected={chosen} onClick={() => select(p.node.id)} onMouseEnter={() => setHover(p.node.id)} onMouseLeave={() => setHover(null)} onKeyDown={(e) => {
              if (e.key.startsWith('Arrow')) { e.preventDefault(); move(e.key); }
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.node.id); }
            }}>
              <title>{p.node.title}</title>
              <circle cx={p.x} cy={p.y} r={Math.max(20, radius + 9)} className={styles.hit} />
              {chosen && <circle cx={p.x} cy={p.y} r={radius + 7} className={styles.selection} />}
              <circle cx={p.x} cy={p.y} r={radius} className={styles.dot} />
              {!group && learner.due && <circle cx={p.x + radius} cy={p.y - radius} r="4" className={styles.due} />}
              {showLabel && <text x={p.x} y={p.y + radius + 23} textAnchor="middle" className={group ? styles.groupLabel : styles.nodeLabel}>{p.node.short}</text>}
            </g>;
          })}
        </svg>
        <div className={styles.mapFoot}><span>Solid: belongs to · Dashed arrow: foundation for</span><span>Arrow keys explore · Enter selects</span></div>
      </div>
      <aside className={styles.inspector} aria-label="Selected skill">
        <div className={styles.detail} aria-live="polite">
          <h2>{selected.title}</h2>
          <p className={styles.state} data-state={isGroup ? 'group' : status.mastery}>{isGroup ? 'Skill group' : masteryWords[status.mastery]}{!isGroup && status.due && <span> · Review due</span>}</p>
          <p>{selected.description}</p>
          <p className={styles.reason}>{policy.reason}</p>
          {selected.prerequisites.length > 0 && <div className={styles.foundations}><h3>Builds on</h3>{selected.prerequisites.map((id) => {
            const node = byId.get(id)!;
            return <button type="button" key={id} onClick={() => select(id)}><span>{node.title}</span><small>{masteryWords[stateOf(id).mastery]}</small></button>;
          })}</div>}
          {isGroup && <div className={styles.foundations}><h3>Explore skills</h3>{points.filter((p) => p.node.parentId === selected.id).map((p) => <button type="button" key={p.node.id} onClick={() => select(p.node.id)}>{p.node.title}</button>)}</div>}
        </div>
        {policy.action && <div className={styles.action}><p>{selected.activity}</p><button type="button" onClick={() => onAction(policy.action!)}>{policy.action.intent === 'learn' ? 'Learn this skill' : 'Review this skill'}<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></button></div>}
      </aside>
    </div>
    <details className={styles.about}><summary>About this map</summary><p>This is a small illustrative subject map, not a complete piano curriculum or an assessment. Grouping is separate from prerequisite arrows. Colors are fictional learner states, not measured probabilities; groups do not inherit mastery from their children. Activity choices use sample prerequisites and the stated goal. Selecting a node never changes its state.</p></details>
  </section>;
}
