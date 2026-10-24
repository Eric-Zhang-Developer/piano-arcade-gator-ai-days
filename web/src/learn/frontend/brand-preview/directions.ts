import type { JourneyPlan } from '../graph/guided-motion';
export const journey={anticipate:100,travel:1000,hold:100,reveal:240} as const;
const clamp=(n:number)=>Math.min(1,Math.max(0,n));
/** One world-space path shared by the guide and following camera. */
export function brandJourney(plan:JourneyPlan,elapsed:number) {
  const u=clamp((elapsed-journey.anticipate)/journey.travel),t=u*u*(3-2*u);
  function path(p:number) {const a=1-p;return {x:a*a*a*plan.source.x+3*a*a*p*(plan.source.x+(plan.target.x-plan.source.x)*.28)+3*a*p*p*(plan.source.x+(plan.target.x-plan.source.x)*.78)+p*p*p*plan.target.x,y:a*a*a*plan.source.y+3*a*a*p*(plan.source.y-60)+3*a*p*p*(plan.target.y-100)+p*p*p*plan.target.y};}
  const world=path(t),tracking=path(Math.max(0,t-.045*Math.sin(Math.PI*t)));
  const {width,height,left,top}=plan.bounds,scale=1+2.2*t;
  const desired={x:plan.source.x+(width/2-plan.source.x)*t,y:plan.source.y+(height/2-plan.source.y)*t-Math.sin(Math.PI*t)*15};
  const camera={scale,x:desired.x-((tracking.x-width/2)*scale+width/2),y:desired.y-((tracking.y-height/2)*scale+height/2)};
  const lift=120*Math.min(1,t/.8);
  return {camera,pet:{x:(world.x-width/2)*scale+width/2+camera.x+left,y:(world.y-height/2)*scale+height/2+camera.y+top-lift,scale:1+.04*Math.sin(Math.PI*t),tilt:-3*Math.sin(Math.PI*t)},progress:t,ready:elapsed>=journey.anticipate+journey.travel+journey.hold};
}
