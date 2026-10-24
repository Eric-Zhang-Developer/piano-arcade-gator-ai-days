'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { LearningSessionsProvider, isSessionComplete, useLearningSessions } from '../LearningSessions';
import { TheoryWorkspace } from '../TheoryWorkspace';
import { rootRelationships, stateOf } from '../graph/data';
import { layoutGraph } from '../graph/layout';
import { anchorLabels, followLabels, branchCurve, curve, overviewCamera, placeLabels, presentation, projectGraph, viewPoints, type AnchoredLabel } from '../graph/projection';
import { preparedActivity } from '../graph/prepared';
import type { JourneyPlan } from '../graph/guided-motion';
import { brandJourney, directions, type Direction } from './directions';
import styles from './brand-preview.module.css';

export function BrandPreview() {
  const [direction,setDirection]=useState<Direction>('practice-room'),[replay,setReplay]=useState(0);
  return <section className={styles.study} aria-label="Brand direction review">
    <div className={styles.review}><div><strong>Brand study</strong><span>Review only · No direction selected</span></div><nav aria-label="Review directions">{(Object.keys(directions) as Direction[]).map(id=><button key={id} type="button" aria-pressed={direction===id} onClick={()=>setDirection(id)}>{directions[id].label}</button>)}</nav><button type="button" onClick={()=>setReplay(n=>n+1)}>Replay from home</button><Link href="/learn">Current version <span aria-hidden="true">↗</span></Link></div>
    <div className={styles.reviewNote}>{directions[direction].description}<span>Authored demo · isolated preview sessions · desktop study</span></div>
    <LearningSessionsProvider key={`${direction}-${replay}`}><BrandFlow direction={direction}/></LearningSessionsProvider>
  </section>;
}
function BrandFlow({direction}:{direction:Direction}) {
  const sessions=useLearningSessions(),spec=directions[direction],complete=isSessionComplete('learn-theory',sessions);
  const [phase,setPhase]=useState<'home'|'travel'|'activity'>('home'),[frame,setFrame]=useState<ReturnType<typeof brandJourney>|null>(null),[reduced,setReduced]=useState(false),[docked,setDocked]=useState<{x:number;y:number;scale:number}|null>(null);
  const [size,setSize]=useState({width:1392,height:660}),[captions,setCaptions]=useState<AnchoredLabel[]>([]);
  const flow=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),pet=useRef<HTMLImageElement>(null),run=useRef<{raf:number;timer?:ReturnType<typeof setTimeout>}|null>(null);
  useEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setSize({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));observer.observe(element);return()=>observer.disconnect();},[phase]);
  useEffect(()=>()=>{if(run.current){cancelAnimationFrame(run.current.raf);clearTimeout(run.current.timer);run.current=null;}setFrame(null);setDocked(null);setPhase('home');},[]);
  useEffect(()=>{if(phase!=='activity'||reduced||!run.current)return;const perch=flow.current?.querySelector('[data-tutor-perch]')?.getBoundingClientRect();const current=run.current;if(perch)current.raf=requestAnimationFrame(()=>{if(run.current===current)setDocked({x:perch.left+perch.width/2,y:perch.top+perch.height/2,scale:perch.width/112});});},[phase,reduced]);
  const projected=useMemo(()=>projectGraph(layoutGraph('theory',rootRelationships),size.width,size.height),[size]);
  const camera=frame?.camera??overviewCamera,points=viewPoints(projected,camera,size.width,size.height);
  const overview=useMemo(()=>{const shown=presentation(projected,null,size.width,size.height);return placeLabels(projected,shown.visible,shown.preview,null,preparedActivity.skillId,1,size.width,size.height);},[projected,size]);
  const labels=frame ? followLabels(captions,points) : overview,{visible,preview}=presentation(points,null,size.width,size.height);
  const pointById=new Map(points.map(point=>[point.node.id,point]));
  function back() {if(run.current){cancelAnimationFrame(run.current.raf);clearTimeout(run.current.timer);run.current=null;}setFrame(null);setDocked(null);setPhase('home');}
  function start(event:MouseEvent<HTMLButtonElement>) {
    if(run.current || phase==='travel')return;
    const bounds=stage.current?.getBoundingClientRect(),source=pet.current?.getBoundingClientRect(),target=projected.find(point=>point.node.id===preparedActivity.skillId);
    if(!bounds||!source||!target)return;
    const plan:JourneyPlan={source:{x:source.left+source.width/2-bounds.left,y:source.top+source.height/2-bounds.top},target:{x:target.screenX,y:target.screenY},bounds:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},title:preparedActivity.title,href:'/learn/understand'};
    if(complete)sessions.restart('learn-theory');
    const current={raf:0,timer:undefined as ReturnType<typeof setTimeout>|undefined};run.current=current;
    setDocked(null);const motion=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(motion.matches);setCaptions(anchorLabels(overview,projected));
    function arrive() {if(run.current!==current)return;sessions.markStarted('learn-theory');setPhase('activity');current.timer=setTimeout(()=>{if(run.current===current){setFrame(null);run.current=null;}},spec.reveal+32);}
    if(motion.matches){arrive();return;}
    setFrame(brandJourney(plan,0,direction));setPhase('travel');const started=event.timeStamp;
    function tick(now:number){if(run.current!==current)return;if(motion.matches){setReduced(true);setFrame(null);arrive();return;}const next=brandJourney(plan,now-started,direction);setFrame(next);if(next.ready)arrive();else current.raf=requestAnimationFrame(tick);}
    current.raf=requestAnimationFrame(tick);
  }
  return <div ref={flow} className={styles.flow} data-brand={direction} data-phase={phase} data-reduced={reduced} style={{'--reveal-ms':`${spec.reveal}ms`} as CSSProperties}>
    <header className={styles.productHeader}><span className={styles.wordmark}>Piano Arcade</span>{phase==='activity' ? <button type="button" onClick={back}>Back to your map</button> : <span className={styles.headerLine}>{direction==='practice-room'?'A little practice, together.':direction==='field-notes'?'One useful step at a time.':'A little room to listen.'}</span>}<span className={styles.demo}>Practice preview</span></header>
    {phase!=='activity' ? <div className={styles.home} data-camera-scale={camera.scale} data-camera-x={camera.x} data-camera-y={camera.y}>
      <div ref={stage} className={styles.plot}><svg className={styles.graph} viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Demo mastery map. Follow the gator to the prepared skill.">
        <defs><marker id={`brand-arrow-${direction}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7Z" className={styles.arrowhead}/></marker></defs>
        <g aria-hidden="true">{points.map(point=>{const parent=point.node.parentId?pointById.get(point.node.parentId):null;return parent&&visible.has(parent.node.id)&&visible.has(point.node.id)&&<path key={point.node.id} className={styles.branch} data-preview={preview.has(point.node.id)} d={branchCurve(parent,point)}/>;})}{rootRelationships.filter(edge=>pointById.has(edge.from)&&pointById.has(edge.to)).map(edge=><path className={styles.backbone} key={`${edge.from}-${edge.to}`} d={curve(pointById.get(edge.from)!,pointById.get(edge.to)!)} markerEnd={`url(#brand-arrow-${direction})`}/>)}</g>
        {points.filter(point=>visible.has(point.node.id)).map(point=>{const state=stateOf(point.node.id),radius=point.depth===0?9:point.depth===1?4.5:2.8;return <g className={styles.node} key={point.node.id} data-skill={point.node.id} data-state={state.displayMastery} data-preview={preview.has(point.node.id)} role="img" aria-label={`${point.node.title}, ${state.displayMastery}, ${state.distributionSource} example`}><title>{point.node.title}</title>{point.node.id===preparedActivity.skillId&&<circle className={styles.target} cx={point.screenX} cy={point.screenY} r={radius+7}/>}<circle className={styles.dot} cx={point.screenX} cy={point.screenY} r={radius}/></g>;})}
        {labels.map(label=><g key={label.id} className={styles.caption} data-label-id={label.id} data-target={label.id===preparedActivity.skillId} aria-hidden="true"><rect className={styles.clearance} x={label.x} y={label.y} width={label.width} height={label.height}/><text className={label.root?styles.rootLabel:styles.childLabel} x={label.x+label.width/2} y={label.y+label.height-6} textAnchor="middle">{label.text}</text></g>)}
      </svg></div>
      <div className={styles.guide}><Image ref={pet} className={styles.pet} src="/learning/companion-gator.svg" alt="Your gator guide" width={112} height={112} unoptimized/><div><h1>{spec.title}</h1><p>{spec.reason}</p><button type="button" className={styles.start} disabled={phase==='travel'} onClick={start}>{complete?'Start again':sessions.started['learn-theory']?'Resume':'Start'}<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h20m-6-6 6 6-6 6"/></svg></button></div></div>
      <footer className={styles.mapFoot}><span>We’re working on phrase endings.</span><span>Sample learner · Twinkle, Twinkle, Little Star</span></footer>
    </div> : <div className={styles.activity} data-revealing={!!frame&&!reduced} data-docking={!!frame&&!reduced} onClickCapture={event=>{const link=(event.target as Element).closest('a');if(link?.getAttribute('href')==='/learn'){event.preventDefault();back();}}}><TheoryWorkspace guide={{instruction:direction==='practice-room'?'Take a moment with the score. Then tell me what you hear.':direction==='field-notes'?'Try an answer. The score and reference are here if you need them.':'Listen, compare, and try an answer. I’m here with the score.'}}/></div>}
    {frame&&<div className={styles.flyingPet} data-progress={frame.progress} data-journey-phase={phase} style={{'--pet-x':`${docked?.x??frame.pet.x}px`,'--pet-y':`${docked?.y??frame.pet.y}px`,'--pet-scale':docked?.scale??frame.pet.scale,'--pet-tilt':`${docked?0:frame.pet.tilt}deg`} as CSSProperties}><Image src="/learning/companion-gator.svg" alt="" width={112} height={112} unoptimized/></div>}
  </div>;
}
