import { expect, it } from 'vitest';
import { activityCamera, cameraAt } from './camera';
import { layoutGraph } from './layout';
import { overviewCamera, projectGraph, viewPoints } from './projection';

it('arrives at the real activity node at either desktop size without changing world geography', () => {
  for (const [width, height] of [[1392, 736], [1232, 636]]) {
    const world = layoutGraph('theory');
    const projected = projectGraph(world, width, height);
    const target = projected.find(point => point.node.id === 'theory.phrase-endings')!;
    const destination = activityCamera(target, width, height);
    const middle = cameraAt(overviewCamera, destination, .35);
    expect(middle.scale).toBeGreaterThan(overviewCamera.scale);
    expect(middle.scale).toBeLessThan(destination.scale);
    const arrived = viewPoints([target], cameraAt(overviewCamera, destination, 1), width, height)[0];
    expect(arrived.screenX).toBeCloseTo(width / 2, 2);
    expect(arrived.screenY).toBeCloseTo(height / 2, 2);
    expect({ x: arrived.x, y: arrived.y, z: arrived.z }).toEqual({ x: target.x, y: target.y, z: target.z });
    expect(cameraAt(overviewCamera, destination, 0)).toEqual(overviewCamera);
  }
});
