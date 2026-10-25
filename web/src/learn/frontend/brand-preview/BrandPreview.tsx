'use client';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { LearningSessionsProvider, isSessionComplete, useLearningSessions } from '../LearningSessions';
import { TheoryWorkspace } from '../TheoryWorkspace';
import { rootRelationships, stateOf } from '../graph/data';
import { layoutGraph } from '../graph/layout';
import { anchorLabels, followLabels, branchCurve, curve, overviewCamera, placeLabels, presentation, projectGraph, viewPoints, type AnchoredLabel } from '../graph/projection';
import { preparedActivity } from '../graph/prepared';
import type { JourneyPlan } from '../graph/guided-motion';
import { brandJourney, journey } from './directions';
import styles from './brand-preview.module.css';

const guideImage='/learning/mentor-gator.png';
const masteryWords = { mastered: 'Secure', developing: 'Partial', unknown: 'Low' };
const references=[
  {name:'Monzo',url:'https://monzo.com/current-account/personal',observed:'Concrete status and recovery controls beside the decision.',applied:'Real musical material and usable hint, listening and recovery controls.'},
  {name:'Lemonade',url:'https://www.lemonade.com/claims',observed:'A legible input, assistance and fallback explanation.',applied:'The student makes the attempt; the preview names its actual limits.'},
  {name:'Waze',url:'https://www.waze.com/live-map/',observed:'A compact foreground task panel over a working map.',applied:'The assignment leads; the mastery graph supplies quiet context.'},
  {name:'Zocdoc',url:'https://www.zocdoc.com/',observed:'Suitability and concrete evidence near the next action.',applied:'Name the phrase and what to listen for before asking for Start.'},
  {name:'Airbnb',url:'https://www.airbnb.com/rooms/1532125051136788312',observed:'Recognizable context and an identifiable host through the decision.',applied:'Keep the same assignment and selected guide from map to score.'},
  {name:'TurboTax',url:'https://turbotax.intuit.com/personal-taxes/online/live/how-it-works.htm',observed:'The customer does the work with assistance beside it.',applied:'The guide stays with the real question, answer and reference workspace.'},
];
function Keymark(){return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 3h24v19a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7Z" fill="currentColor"/><path d="M12 3v14m8-14v14" stroke="var(--brand-bg)" strokeWidth="3"/></svg>;}
export function BrandPreview() {
  const [replay,setReplay]=useState(0),[sources,setSources]=useState(false);
  return <section className={styles.study} aria-label="Brand direction review">
    <div className={styles.review}><div><strong>Proposed preview</strong><span>Authored demo · Sample learner · Local session</span></div><button type="button" aria-expanded={sources} onClick={()=>setSources(v=>!v)}>{sources?'Close references':'References & application'}</button><button type="button" onClick={()=>setReplay(n=>n+1)}>Replay from home</button></div>
    {sources&&<aside className={styles.sources} aria-label="Reference and application"><header><h2>Borrow the useful behavior.</h2><button type="button" onClick={()=>setSources(false)}>Close references</button></header><p>Official public interfaces inspected in Chrome. Banking, insurance, booking and filing flows were not completed. Waze’s initial public planner was inspected; no route was submitted. Emotional effects are design inferences.</p><div className={styles.sourceGrid}>{references.map(source=><article key={source.name}><h3><a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a></h3><p><b>Observed:</b> {source.observed}</p><p><b>Applied:</b> {source.applied}</p></article>)}</div><p>One original working system: open sans typography, a piano-key foot shape, restrained cobalt actions, ink and warm white, plus the selected upright alligator. No brand assets, marketing-page compositions or guarantees were copied. Authored demo sessions are isolated from the current product.</p></aside>}
    <div className={styles.student} inert={sources || undefined} aria-hidden={sources || undefined}><LearningSessionsProvider key={replay}><BrandFlow/></LearningSessionsProvider></div>
  </section>;
}
function BrandFlow() {
  const sessions=useLearningSessions(),spec=journey,complete=isSessionComplete('learn-theory',sessions);
  const [phase,setPhase]=useState<'home'|'travel'|'docking'|'activity'>('home'),[frame,setFrame]=useState<ReturnType<typeof brandJourney>|null>(null),[reduced,setReduced]=useState(false),[docked,setDocked]=useState<{x:number;y:number;scale:number}|null>(null);
  const [size,setSize]=useState({width:1392,height:660}),[captions,setCaptions]=useState<AnchoredLabel[]>([]);
  const flow=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),pet=useRef<HTMLImageElement>(null),run=useRef<{raf:number;timer?:ReturnType<typeof setTimeout>}|null>(null);
  useEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));observer.observe(element);return()=>observer.disconnect();},[phase]);
  useEffect(()=>()=>{if(run.current){cancelAnimationFrame(run.current.raf);clearTimeout(run.current.timer);run.current=null;}setFrame(null);setDocked(null);setPhase('home');},[]);
  useEffect(()=>{
    if(phase!=='docking'||!run.current)return;
    const perch=flow.current?.querySelector('[data-tutor-perch]')?.getBoundingClientRect(),current=run.current;
    if(!perch)return;
    current.raf=requestAnimationFrame(()=>{if(run.current!==current)return;setDocked({x:perch.left+perch.width/2,y:perch.top+perch.height/2,scale:1});
      current.timer=setTimeout(()=>{if(run.current!==current)return;setPhase('activity');current.timer=setTimeout(()=>{if(run.current===current){setFrame(null);run.current=null;}},spec.reveal+32);},spec.dock+32);
    });
  },[phase,spec.dock,spec.reveal]);
  useEffect(()=>{if(phase==='activity'&&!frame)flow.current?.querySelector<HTMLHeadingElement>('h1')?.focus({preventScroll:true});},[phase,frame]);
  const projected=useMemo(()=>projectGraph(layoutGraph('theory',rootRelationships),size.width,size.height),[size]);
  const camera=frame?.camera??overviewCamera,points=viewPoints(projected,camera,size.width,size.height);
  const overview=useMemo(()=>{const shown=presentation(projected,null,size.width,size.height);return placeLabels(projected,shown.visible,shown.preview,null,preparedActivity.skillId,1,size.width,size.height);},[projected,size]);
  const labels=frame ? followLabels(captions,points) : overview,{visible,preview}=presentation(points,null,size.width,size.height);
  const pointById=new Map(points.map(point=>[point.node.id,point]));
  function back() {if(run.current){cancelAnimationFrame(run.current.raf);clearTimeout(run.current.timer);run.current=null;}setFrame(null);setDocked(null);setPhase('home');requestAnimationFrame(()=>flow.current?.querySelector<HTMLButtonElement>('[data-start]')?.focus({preventScroll:true}));}
  function start(event:MouseEvent<HTMLButtonElement>) {
    if(run.current || phase==='travel')return;
    const bounds=stage.current?.getBoundingClientRect(),source=pet.current?.getBoundingClientRect(),target=projected.find(point=>point.node.id===preparedActivity.skillId);
    if(!bounds||!source||!target)return;
    const plan:JourneyPlan={source:{x:source.left+source.width/2-bounds.left,y:source.top+source.height/2-bounds.top},target:{x:target.screenX,y:target.screenY},bounds:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},title:preparedActivity.title,href:'/learn/understand'};
    if(complete)sessions.restart('learn-theory');
    const current={raf:0,timer:undefined as ReturnType<typeof setTimeout>|undefined};run.current=current;
    setDocked(null);const motion=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(motion.matches);setCaptions(anchorLabels(overview,projected));
    function arrive() {if(run.current!==current)return;sessions.markStarted('learn-theory');if(motion.matches){setPhase('activity');run.current=null;}else setPhase('docking');}
    if(motion.matches){arrive();return;}
    setFrame(brandJourney(plan,0));setPhase('travel');const started=event.timeStamp;
    function tick(now:number){if(run.current!==current)return;if(motion.matches){setReduced(true);setFrame(null);arrive();return;}const next=brandJourney(plan,now-started);setFrame(next);if(next.ready)arrive();else current.raf=requestAnimationFrame(tick);}
    current.raf=requestAnimationFrame(tick);
  }
  return <div ref={flow} className={styles.flow} data-phase={phase} data-reduced={reduced} style={{'--reveal-ms':`${spec.reveal}ms`,'--dock-ms':`${spec.dock}ms`} as CSSProperties}>
    <header className={styles.productHeader}><span className={styles.wordmark}><Keymark/>Piano Arcade</span>{phase==='activity' ? <button type="button" onClick={back}>Back to your map</button> : null}</header>
    {phase!=='activity' ? <div className={styles.home} data-camera-scale={camera.scale} data-camera-x={camera.x} data-camera-y={camera.y}>
      <div ref={stage} className={styles.plot}><svg className={styles.graph} viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Demo mastery map. Follow the gator to the prepared skill.">
        <defs><marker id={`brand-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7Z" className={styles.arrowhead}/></marker></defs>
        <g aria-hidden="true">{points.map(point=>{const parent=point.node.parentId?pointById.get(point.node.parentId):null;return parent&&visible.has(parent.node.id)&&visible.has(point.node.id)&&<path key={point.node.id} className={styles.branch} data-preview={preview.has(point.node.id)} d={branchCurve(parent,point)}/>;})}{rootRelationships.filter(edge=>pointById.has(edge.from)&&pointById.has(edge.to)).map(edge=><path className={styles.backbone} key={`${edge.from}-${edge.to}`} d={curve(pointById.get(edge.from)!,pointById.get(edge.to)!)} markerEnd={`url(#brand-arrow)`}/>)}</g>
        {points.filter(point=>visible.has(point.node.id)).map(point=>{const state=stateOf(point.node.id),radius=point.depth===0?9:point.depth===1?4.5:2.8;return <g className={styles.node} key={point.node.id} data-skill={point.node.id} data-state={state.displayMastery} data-preview={preview.has(point.node.id)} role="img" aria-label={`${point.node.title}, ${masteryWords[state.displayMastery]}, ${state.distributionSource} example`}><title>{point.node.title}</title>{point.node.id===preparedActivity.skillId&&<circle className={styles.target} cx={point.screenX} cy={point.screenY} r={radius+7}/>}<circle className={styles.dot} cx={point.screenX} cy={point.screenY} r={radius}/></g>;})}
        {labels.map(label=><g key={label.id} className={styles.caption} data-label-id={label.id} data-target={label.id===preparedActivity.skillId} aria-hidden="true"><rect className={styles.clearance} x={label.x} y={label.y} width={label.width} height={label.height}/><text className={label.root?styles.rootLabel:styles.childLabel} x={label.x+label.width/2} y={label.y+label.height-6} textAnchor="middle">{label.text}</text></g>)}
      </svg></div>
      <section className={styles.guide} aria-label="Your next activity"><Image ref={pet} className={styles.pet} src={guideImage} alt="Your upright alligator guide, inviting you to begin" width={112} height={112} unoptimized priority/><h1>Hearing a phrase come home</h1><p>Listen to two short phrases. Which ending feels more at rest?</p><div className={styles.material}><span>Twinkle, Twinkle, Little Star</span><span>C major · Two phrases · Three questions</span></div><button type="button" className={styles.start} data-start disabled={phase!=='home'} onClick={start}>{phase!=='home'?'On our way':complete?'Start again':sessions.started['learn-theory']?'Resume':'Start'}<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20m-6-6 6 6-6 6"/></svg></button>{phase!=='home'&&<button type="button" className={styles.stop} onClick={back}>Stop and stay here</button>}</section>
    </div> : null}
    {phase!=='home'&&phase!=='travel'&&<div className={styles.activity} data-staged={phase==='docking'} inert={phase==='docking' || undefined} aria-hidden={phase==='docking' || undefined} data-revealing={phase==='activity'&&!!frame&&!reduced} data-docking={!!frame&&!reduced} onClickCapture={event=>{const link=(event.target as Element).closest('a');if(link?.getAttribute('href')==='/learn'){event.preventDefault();back();}}}><TheoryWorkspace guide={{imageSrc:guideImage,size:112,instruction:'Listen, compare, and try an answer. The score and a hint are here when you need them.'}}/></div>}
    {frame&&<div className={styles.flyingPet} data-progress={frame.progress} data-journey-phase={phase} data-docked={!!docked} style={{'--pet-x':`${docked?.x??frame.pet.x}px`,'--pet-y':`${docked?.y??frame.pet.y}px`,'--pet-scale':docked?.scale??frame.pet.scale,'--pet-tilt':`${docked?0:frame.pet.tilt}deg`} as CSSProperties}><Image src={guideImage} alt="" width={112} height={112} unoptimized/></div>}
  </div>;
}
