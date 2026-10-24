import type { JourneyPlan } from '../graph/guided-motion';
export const directions = {
  'practice-room': { label:'Practice Room', description:'Warm paper, a trusted teacher. Measured travel and an opening-page reveal.', title:'Let’s hear where it settles.', reason:'Two short endings. Listen closely, then choose the one that feels at rest.', anticipate:120,travel:1150,hold:100,reveal:300,lean:3,depth:.035,bow:40 },
  'field-notes': { label:'Field Notes', description:'A practical field journal. A buoyant guide, then room to try.', title:'Hear a phrase come home', reason:'Let’s listen for what makes an ending feel settled.', anticipate:100,travel:1000,hold:100,reveal:220,lean:8,depth:.08,bow:100 },
  'after-hours': { label:'After Hours', description:'A quiet evening at the piano. A slow curved drift and a gentle reveal.', title:'Listen for a place to rest.', reason:'Take two short phrases. Compare their endings and tell me what you hear.', anticipate:140,travel:1200,hold:100,reveal:300,lean:2,depth:.02,bow:150 },
} as const;
export type Direction = keyof typeof directions;
const clamp=(n:number)=>Math.min(1,Math.max(0,n));
export function brandJourney(plan:JourneyPlan,elapsed:number,direction:Direction) {
  const spec=directions[direction],u=clamp((elapsed-spec.anticipate)/spec.travel);
  const t=direction==='practice-room' ? 1-Math.pow(1-u,3) : direction==='after-hours' ? u*u*u*(u*(u*6-15)+10) : u*u*(3-2*u);
  function path(p:number) { const a=1-p;return {x:a*a*a*plan.source.x+3*a*a*p*(plan.source.x+(plan.target.x-plan.source.x)*.28)+3*a*p*p*(plan.source.x+(plan.target.x-plan.source.x)*.78)+p*p*p*plan.target.x,y:a*a*a*plan.source.y+3*a*a*p*(plan.source.y-spec.bow*.6)+3*a*p*p*(plan.target.y-spec.bow)+p*p*p*plan.target.y}; }
  const world=path(t),tracking=path(Math.max(0,t-(direction==='field-notes'?.05:.025)*Math.sin(Math.PI*t)));
  const {width,height,left,top}=plan.bounds,scale=1+(direction==='after-hours'?1.8:2.2)*t;
  const desired={x:plan.source.x+(width/2-plan.source.x)*t,y:plan.source.y+(height/2-plan.source.y)*t-Math.sin(Math.PI*t)*spec.bow*.15};
  const camera={scale,x:desired.x-((tracking.x-width/2)*scale+width/2),y:desired.y-((tracking.y-height/2)*scale+height/2)};
  const lift=100*Math.min(1,t/.8);
  return {camera,pet:{x:(world.x-width/2)*scale+width/2+camera.x+left,y:(world.y-height/2)*scale+height/2+camera.y+top-lift,scale:1+spec.depth*Math.sin(Math.PI*t),tilt:-spec.lean*Math.sin(Math.PI*t)},progress:t,ready:elapsed>=spec.anticipate+spec.travel+spec.hold};
}
