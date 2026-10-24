import type { Camera, ScreenPoint } from './projection';

/** Center the actual projected target without changing any world coordinates. */
export function activityCamera(target: ScreenPoint, width: number, height: number): Camera {
  const scale = 3.2;
  return { scale, x: -(target.screenX - width / 2) * scale, y: -(target.screenY - height / 2) * scale };
}

export function cameraAt(from: Camera, to: Camera, progress: number): Camera {
  const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 4);
  return { scale: from.scale + (to.scale - from.scale) * eased, x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}
