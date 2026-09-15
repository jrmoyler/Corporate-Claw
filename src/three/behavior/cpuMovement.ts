import { findOfficeRoute } from './navigation';
import { AgentBehavior } from '../../types';

type Obstacle = { position: { x: number; z: number }; radius: number };
type Settings = { speed: number; worldSize: number; separationRadius: number; separationStrength: number };

/** Drop from standing to seated: puts the hips on the ~1.10 seat cushions the office actually builds. */
export const SEAT_DROP = -.30;

const routeCaches = new WeakMap<Float32Array, Map<number, {x:number;z:number;limit:number;obstacles:Obstacle[];points:{x:number;z:number}[]}>>();

/** WebGL movement uses the same vec4 position/state layout as the GPU path. */
export function stepCPUAgents(positions: Float32Array, velocities: Float32Array, states: Float32Array, delta: number, settings: Settings, obstacles: Obstacle[]) {
  const count = positions.length / 4;
  const previous = positions.slice();
  let routes=routeCaches.get(positions);
  if(!routes){routes=new Map();routeCaches.set(positions,routes);}
  const frameScale = Math.min(Math.max(delta, 0) * 60, 3);
  const limit = Math.max(1, settings.worldSize - 1);
  const cellSize = Math.max(.1, settings.separationRadius);
  const cells = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    if (states[i * 4 + 3] === AgentBehavior.OFFLINE) continue;
    const key = `${Math.floor(previous[i * 4] / cellSize)},${Math.floor(previous[i * 4 + 2] / cellSize)}`;
    const cell = cells.get(key) ?? [];
    cell.push(i); cells.set(key, cell);
  }
  for (let i = 0; i < count; i++) {
    const k = i * 4, state = states[k + 3];
    let x = previous[k], z = previous[k + 2];
    let vx = velocities[k], vz = velocities[k + 2];
    if (state === AgentBehavior.OFFLINE) {
      positions.set([0, -100, 0, 1], k); continue;
    }
    if (state !== AgentBehavior.BOIDS && state !== AgentBehavior.GOTO) {
      positions[k + 1] = state === AgentBehavior.SIT ? SEAT_DROP : state === AgentBehavior.WORKOUT ? .1 : 0;
      if (Math.hypot(states[k], states[k + 2]) > .001) {
        velocities[k] = states[k]; velocities[k + 2] = states[k + 2];
      }
      continue;
    }
    // Waypoints (including lifecycle exits) are not constrained by the boids inset.
    const movementLimit = state === AgentBehavior.GOTO
      ? Math.max(limit, Math.abs(states[k]), Math.abs(states[k + 2]))
      : limit;
    if (state === AgentBehavior.GOTO) {
      let route=routes.get(i);
      if(!route||route.x!==states[k]||route.z!==states[k+2]||route.limit!==movementLimit||route.obstacles!==obstacles){
        route={x:states[k],z:states[k+2],limit:movementLimit,obstacles,points:findOfficeRoute({x,z},{x:states[k],z:states[k+2]},obstacles,movementLimit)};routes.set(i,route);
      }
      while(route.points.length>1&&Math.hypot(route.points[0].x-x,route.points[0].z-z)<.3)route.points.shift();
      const target=route.points[0];if(!target){velocities[k]=velocities[k+2]=0;continue;}
      const dx = target.x - x, dz = target.z - z, distance = Math.hypot(dx, dz);
      if (distance <= .2) continue;
      const speed = Math.min(settings.speed * 3, distance / Math.max(frameScale, .001));
      vx = dx / distance * speed; vz = dz / distance * speed;
    } else {
      const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        for (const j of cells.get(`${cx + ox},${cz + oz}`) ?? []) {
          const dx = x - previous[j * 4], dz = z - previous[j * 4 + 2], distance = Math.hypot(dx, dz);
          if (distance > .01 && distance < settings.separationRadius) {
            vx += dx / distance * settings.separationStrength;
            vz += dz / distance * settings.separationStrength;
          }
        }
      }
      if (Math.abs(x) > limit - .5 || Math.abs(z) > limit - .5) {
        const distance = Math.hypot(x, z) || 1;
        vx -= x / distance * .05; vz -= z / distance * .05;
      }
    }
    for (const obstacle of obstacles) {
      const dx = x - obstacle.position.x, dz = z - obstacle.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < obstacle.radius + (state === AgentBehavior.GOTO ? .4 : .8)) {
        const push = state === AgentBehavior.GOTO ? settings.speed * 2 : settings.separationStrength * 8;
        vx += (distance > .001 ? dx / distance : 1) * push;
        vz += (distance > .001 ? dz / distance : 0) * push;
      }
    }
    if (state === AgentBehavior.BOIDS) {
      const speed = Math.hypot(vx, vz);
      if (speed > .001) { vx = vx / speed * settings.speed; vz = vz / speed * settings.speed; }
      else { vx = 0; vz = settings.speed; }
    }
    positions.set([Math.max(-movementLimit, Math.min(movementLimit, x + vx * frameScale)), 0, Math.max(-movementLimit, Math.min(movementLimit, z + vz * frameScale)), 1], k);
    velocities[k] = vx; velocities[k + 2] = vz;
  }
}
