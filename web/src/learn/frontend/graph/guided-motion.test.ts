import { expect, it } from 'vitest';
import { actionFor, byId } from './data';
import { contextualActivity } from './prepared';
import { journeyFrame } from './guided-motion';
import { layoutGraph } from './layout';
import { projectGraph } from './projection';

it('takes the ink and camera from the perch to every supported learning/retrieval target at both desktop sizes', () => {
  const ids = ['theory.phrase-endings','theory.tonal-center','procedure.short-phrase-coordination','procedure.held-endings','procedure.steady-pulse'];
  for (const [width,height] of [[1392,736],[1232,636]]) for (const id of ids) {
    const skill = byId.get(id)!, activity = contextualActivity(actionFor(skill).action!)!;
    const point = projectGraph(layoutGraph(skill.domain),width,height).find(p=>p.node.id===id)!;
    const plan = {source:{x:88,y:106},target:{x:point.screenX,y:point.screenY},bounds:{left:24,top:128,width,height},href:activity.activity.href,title:skill.title};
    const first = journeyFrame(plan,0), middle = journeyFrame(plan,600), last = journeyFrame(plan,1200);
    expect(first.camera).toEqual({scale:1,x:0,y:0});
    expect(first.pet.x).toBe(112); expect(first.pet.y).toBe(234);
    expect(middle.pet.x).not.toBe(first.pet.x);
    expect(middle.camera.scale).toBeGreaterThan(1); expect(middle.camera.scale).toBeLessThan(3.2);
    expect(middle.pet.tilt).not.toBe(0);
    expect((point.screenX-width/2)*last.camera.scale+width/2+last.camera.x).toBeCloseTo(width/2,8);
    expect((point.screenY-height/2)*last.camera.scale+height/2+last.camera.y).toBeCloseTo(height/2,8);
    expect(last.pet.x).toBeCloseTo(24+width/2,8);
    expect(last.pet.y+100).toBeCloseTo(128+height/2,8);
    expect(last.pet.y+56).toBeLessThan(128+height/2-20);
    expect(last.phase).toBe('arriving');
  }
});
