import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCPUAgents } from '../src/three/behavior/cpuMovement';
import { AgentBehavior } from '../src/types';
import { verifyAssets } from '../scripts/verify-assets.mjs';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CPUAgentRenderer } from '../src/three/entities/CPUAgentRenderer';

const settings = { speed: .015, worldSize: 30, separationRadius: .8, separationStrength: .05 };
test('WebGL agents move toward waypoints and stop without overshoot', () => {
  const p = new Float32Array([0,0,0,1]);
  const v = new Float32Array(4);
  const state = new Float32Array([2,0,0,AgentBehavior.GOTO]);
  for (let n=0;n<120;n++) stepCPUAgents(p,v,state,1/60,settings,[]);
  assert.ok(p[0] > 1.8 && p[0] <= 2);
  const last = p[0]; stepCPUAgents(p,v,state,1/60,settings,[]); assert.equal(p[0], last);
});
test('WebGL movement is frame-rate independent on an unobstructed path', () => {
  function run(fps: number) {
    const p = new Float32Array([0,0,0,1]), v = new Float32Array(4), s = new Float32Array([20,0,0,AgentBehavior.GOTO]);
    for(let n=0;n<fps;n++) stepCPUAgents(p,v,s,1/fps,settings,[]);
    return p[0];
  }
  assert.ok(Math.abs(run(30)-run(60)) < .0001);
});
test('WebGL preserves held states, seating height, offline visibility and finite obstacle avoidance', () => {
  const p = new Float32Array([0,0,0,1, 2,0,2,1, 3,0,3,1, 29,0,29,1]);
  const v = new Float32Array(16);
  const s = new Float32Array([0,0,0,AgentBehavior.BOIDS, 0,0,1,AgentBehavior.SIT, 0,0,0,AgentBehavior.OFFLINE, 0,0,0,AgentBehavior.FROZEN]);
  stepCPUAgents(p,v,s,1/60,settings,[{position:{x:0,z:0},radius:2}]);
  assert.ok(Array.from(p).every(Number.isFinite)); assert.ok(p[0] > 0);
  assert.equal(p[4],2); assert.ok(Math.abs(p[5]+.45)<.00001); assert.equal(p[9],-100); assert.equal(p[12],29);
});
test('WebGL crowd stays inside office boundaries', () => {
  const p = new Float32Array([29,0,29,1]), v = new Float32Array([1,0,1,0]), s = new Float32Array(4);
  for(let n=0;n<300;n++) stepCPUAgents(p,v,s,1/30,settings,[]);
  assert.ok(Math.abs(p[0])<=29 && Math.abs(p[2])<=29);
});
test('deployment includes the real character rig and lounge furniture', () => verifyAssets());

test('WebGL renderer clones the real rig, animates it, preserves faces and disposes the population', async () => {
  // Only image decoding is stubbed: geometry, skeleton and animation data are real.
  const originalSelf = globalThis.self;
  const originalBitmap = globalThis.createImageBitmap;
  Object.assign(globalThis, { self: globalThis, createImageBitmap: async () => ({ width: 64, height: 64, close() {} }) });
  try {
    const bytes = readFileSync('public/models/character.glb');
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const scene = new THREE.Scene();
    const renderer = new CPUAgentRenderer(scene, gltf.scene, gltf.animations, 2, ['#ff0000','#0000ff']);
    const p = new Float32Array([2,0,3,1, 4,0,5,1]), v = new Float32Array([0,0,1,0, 1,0,0,0]);
    const states = new Float32Array([0,0,0,AgentBehavior.BOIDS, 0,0,0,AgentBehavior.OFFLINE]);
    renderer.update(.1,p,v,states,new Float32Array(8));
    assert.equal(scene.children.length,2); assert.deepEqual(scene.children[0].position.toArray(),[2,0,3]);
    assert.equal(scene.children[1].visible,false);
    let skins = 0;
    scene.children[0].traverse((object: any) => {
      if (!object.isSkinnedMesh) return;
      skins++; object.updateMatrixWorld(true); object.skeleton.update();
      assert.ok(Array.from(object.skeleton.boneMatrices as Float32Array).every(Number.isFinite));
      assert.equal(object.material.opacity,1);
    });
    assert.equal(skins,3);
    renderer.dispose(); assert.equal(scene.children.length,0);
  } finally {
    Object.assign(globalThis, { self: originalSelf, createImageBitmap: originalBitmap });
  }
});
