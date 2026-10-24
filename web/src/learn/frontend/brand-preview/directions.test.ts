import { expect, it } from 'vitest';
import { directions, brandJourney, type Direction } from './directions';
import { layoutGraph } from '../graph/layout';
import { rootRelationships } from '../graph/data';
import { projectGraph } from '../graph/projection';
it('gives every direction a distinct journey while arriving at the actual shared skill clear of its caption',()=>{
  for(const [width,height] of [[1392,736],[936,630]]) {
    const node=projectGraph(layoutGraph('theory',rootRelationships),width,height).find(p=>p.node.id==='theory.phrase-endings')!;
    const plan={source:{x:70,y:100},target:{x:node.screenX,y:node.screenY},bounds:{left:24,top:164,width,height},href:'/learn/understand',title:'Hearing a phrase come home'};
    const mids=[];
    for(const direction of Object.keys(directions) as Direction[]) {
      const spec=directions[direction],first=brandJourney(plan,0,direction),last=brandJourney(plan,spec.anticipate+spec.travel+spec.hold,direction);
      expect(first.camera).toEqual({scale:1,x:0,y:0});
      expect(last.ready).toBe(true);
      expect((node.screenX-width/2)*last.camera.scale+width/2+last.camera.x).toBeCloseTo(width/2,8);
      expect((node.screenY-height/2)*last.camera.scale+height/2+last.camera.y).toBeCloseTo(height/2,8);
      expect(last.pet.y+56).toBeLessThan(164+height/2-20);
      mids.push(brandJourney(plan,700,direction).progress);
    }
    expect(new Set(mids).size).toBe(3);
  }
});
