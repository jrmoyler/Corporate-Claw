import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createSuitedAgent, CUP_ON_FOREARM, MOUTH_ON_HEAD } from '../src/three/entities/createSuitedAgent';
import { SEAT_DROP } from '../src/three/behavior/cpuMovement';

function posed(clip?: string, time = 0) {
  const { scene, animations } = createSuitedAgent();
  if (clip) { const mixer = new T.AnimationMixer(scene); mixer.clipAction(animations.find(c => c.name === clip)!).play(); mixer.setTime(time); }
  scene.updateMatrixWorld(true);
  const meshes: T.SkinnedMesh[] = [];
  scene.traverse((o: any) => { if (o.isSkinnedMesh) { o.skeleton.update(); meshes.push(o); } });
  return { scene, meshes, bone: (name: string) => scene.getObjectByName(name)!.getWorldPosition(new T.Vector3()) };
}
function vertices(meshes: T.SkinnedMesh[], names?: string[]) {
  const out: T.Vector3[] = [];
  for (const mesh of meshes) {
    if (names && !names.includes(mesh.name)) continue;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) out.push(mesh.getVertexPosition(i, new T.Vector3()));
  }
  return out;
}
const bounds = (points: T.Vector3[]) => points.reduce((b, p) => b.expandByPoint(p), new T.Box3());

test('the figure keeps adult proportions on the office floor', () => {
  const rig = posed();
  const body = bounds(vertices(rig.meshes));
  const stature = body.max.y;
  assert.ok(Math.abs(stature - 3.23) < .03, `stature ${stature}`);
  assert.ok(Math.abs(body.min.y) < .01, `soles must rest on the floor, got ${body.min.y}`);
  // Canonical adult ratios: head an eighth of stature, shoulder at four fifths,
  // hip just under half, knee around a quarter.
  const head = bounds(vertices(rig.meshes, ['Skin'])).max.y - rig.bone('Head').y;
  assert.ok(Math.abs(head / stature - .134) < .012, `head ${(head / stature).toFixed(3)} of stature`);
  for (const [name, ratio, tolerance] of [['Head', .864, .015], ['LeftArm', .817, .015], ['Pelvis', .48, .015], ['LeftShin', .263, .015]] as const)
    assert.ok(Math.abs(rig.bone(name).y / stature - ratio) < tolerance, `${name} at ${(rig.bone(name).y / stature).toFixed(3)} of stature`);
  const shoulders = rig.bone('LeftArm').distanceTo(rig.bone('RightArm')) / stature;
  assert.ok(shoulders > .19 && shoulders < .25, `biacromial ${shoulders.toFixed(3)} of stature`);
  const reach = bounds(vertices(rig.meshes, ['Skin'])).min.y;
  assert.ok(reach < rig.bone('Pelvis').y, 'hands must hang past the hip at rest');
});

test('every surface joins one body, with no detached or floating parts', () => {
  // Union-find over a 0.08 grid of points sampled across each triangle, not
  // just its corners: a limb, garment or accessory that does not touch the
  // figure lands in its own component.
  const cell = .08, parent = new Map<string, string>();
  const key = (p: T.Vector3) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
  const find = (k: string): string => { const up = parent.get(k)!; return up === k ? k : (parent.set(k, find(up)), parent.get(k)!); };
  const add = (p: T.Vector3) => { const k = key(p); if (!parent.has(k)) parent.set(k, k); };
  for (const mesh of posed().meshes) {
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const corners: T.Vector3[] = [];
    for (let i = 0; i < position.count; i++) corners.push(mesh.getVertexPosition(i, new T.Vector3()));
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(o => corners[index ? index.getX(i + o) : i + o]);
      const steps = Math.min(24, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / .035));
      for (let u = 0; u <= steps; u++) for (let v = 0; u + v <= steps; v++)
        add(new T.Vector3().addScaledVector(a, u / steps).addScaledVector(b, v / steps).addScaledVector(c, (steps - u - v) / steps));
    }
  }
  for (const k of [...parent.keys()]) {
    const [x, y, z] = k.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const other = `${x + dx},${y + dy},${z + dz}`;
      if (parent.has(other)) { const a = find(k), b = find(other); if (a !== b) parent.set(a, b); }
    }
  }
  assert.equal(new Set([...parent.keys()].map(find)).size, 1, 'figure must be a single connected body');
});

test('each clip drives the rig it is authored for', () => {
  const walk = posed('Walk', 0);
  assert.ok(walk.bone('LeftShin').z * walk.bone('RightShin').z < 0, 'walk must swing the legs in opposition');
  const swing = posed('Walk', .55);
  assert.ok(walk.bone('LeftShin').distanceTo(swing.bone('LeftShin')) > .3, 'walk must carry the stride through the cycle');
  assert.ok(Math.abs(walk.bone('Pelvis').y - posed('Walk', .275).bone('Pelvis').y) > .015, 'walk must bob the pelvis');
  const idle = posed('Idle', 2);
  assert.ok(idle.bone('Head').distanceTo(posed('Idle', 0).bone('Head')) > .005, 'idle must breathe rather than freeze');
  const talk = posed('Talk', 1.55);
  assert.ok(talk.bone('RightForearm').z > .2, 'talk must gesture in front of the body');
});

test('the seated pose meets the office seat, floor and desk', () => {
  const seated = posed('Sit', 1.2);
  const drop = new T.Vector3(0, SEAT_DROP, 0);
  const sole = bounds(vertices(seated.meshes, ['Shoes'])).min.y + SEAT_DROP;
  assert.ok(sole > -.02 && sole < .1, `shoes must reach the floor, got ${sole.toFixed(3)}`);
  const pelvis = seated.bone('Pelvis');
  const seat = vertices(seated.meshes, ['Suit']).filter(p => Math.hypot(p.x - pelvis.x, p.z - pelvis.z) < .3);
  const buttock = bounds(seat).min.y + SEAT_DROP;
  assert.ok(buttock > .95 && buttock < 1.12, `hips must rest on the ~1.10 seat cushion, got ${buttock.toFixed(3)}`);
  const hand = seated.scene.getObjectByName('RightForearm')!.localToWorld(new T.Vector3(0, -.595, .006)).add(drop);
  assert.ok(Math.abs(hand.y - 1.65) < .12, `hands must land on the 1.65 desk, got ${hand.y.toFixed(3)}`);
  assert.ok(hand.z > .5, 'hands must reach forward across the desk');
});

test('the sip brings the cup rim to the mouth and returns it', () => {
  const gap = (time: number) => {
    const rig = posed('Coffee', time);
    return rig.scene.getObjectByName('RightForearm')!.localToWorld(new T.Vector3(...CUP_ON_FOREARM))
      .distanceTo(rig.scene.getObjectByName('Head')!.localToWorld(new T.Vector3(...MOUTH_ON_HEAD)));
  };
  assert.ok(gap(1.9) < .05, `cup must meet the mouth, got ${gap(1.9).toFixed(3)}`);
  assert.ok(gap(0) > .5, `cup must rest away from the face between sips, got ${gap(0).toFixed(3)}`);
});
