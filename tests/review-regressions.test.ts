import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import { validateGLB, verifyAssets } from '../scripts/verify-assets.mjs';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stepCPUAgents } from '../src/three/behavior/cpuMovement';
import { AgentBehavior } from '../src/types';
import { CPUAgentRenderer } from '../src/three/entities/CPUAgentRenderer';
import { CharacterManager } from '../src/three/entities/CharacterManager';
import { createSuitedAgent } from '../src/three/entities/createSuitedAgent';
import { WEBGL_AGENT_LIMIT, WEBGPU_AGENT_LIMIT } from '../src/three/entities/populationLimits';
import { useStore } from '../src/store/useStore';

// Minimal valid skinned triangle. Mutations leave JSON metadata present but corrupt binary data.
function rigFixture(mutate: (json: any, bin: Buffer) => void = () => {}) {
  const bin = Buffer.alloc(160);
  [0,0,0, 1,0,0, 0,1,0].forEach((n,i) => bin.writeFloatLE(n,i*4));
  for (let i=0;i<3;i++) bin.writeFloatLE(1,48+i*16);
  for (let i=0;i<4;i++) bin.writeFloatLE(1,96+i*20);
  const json = {
    asset:{version:'2.0'}, scene:0, scenes:[{nodes:[0,1]}],
    nodes:[{mesh:0,skin:0},{}], skins:[{joints:[1],inverseBindMatrices:3}],
    meshes:[{primitives:[{attributes:{POSITION:0,JOINTS_0:1,WEIGHTS_0:2}}]}],
    buffers:[{byteLength:160}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962},{buffer:0,byteOffset:36,byteLength:12,target:34962},{buffer:0,byteOffset:48,byteLength:48,target:34962},{buffer:0,byteOffset:96,byteLength:64}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}, {bufferView:1,componentType:5121,count:3,type:'VEC4'}, {bufferView:2,componentType:5126,count:3,type:'VEC4'}, {bufferView:3,componentType:5126,count:1,type:'MAT4'}]
  };
  mutate(json,bin);
  const encoded=Buffer.from(JSON.stringify(json));
  const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,32);encoded.copy(padded);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,padded,chunk,bin]);
}

test('binary GLB validation accepts a valid rig and rejects non-finite values, bounds and invalid skin joints', async () => {
  await validateGLB(rigFixture());
  await assert.rejects(validateGLB(rigFixture((_,bin)=>bin.writeFloatLE(NaN,0))), /ACCESSOR_INVALID_FLOAT/);
  await assert.rejects(validateGLB(rigFixture((json)=>json.accessors[0].count=4)), /ACCESSOR_TOO_LONG/);
  await assert.rejects(validateGLB(rigFixture((_,bin)=>bin[36]=244)), /ACCESSOR_JOINTS_INDEX_OOB/);
  await assert.rejects(validateGLB(rigFixture((_,bin)=>bin.writeFloatLE(Infinity,96))), /ACCESSOR_INVALID_FLOAT/);
  const truncated=rigFixture().subarray(0,-4);
  await assert.rejects(validateGLB(truncated), /GLB/);
});

test('deployment verification discovers corrupt GLBs even outside the models directory', async () => {
  const root=mkdtempSync(join(tmpdir(),'claw-assets-'));
  try {
    mkdirSync(join(root,'models'));mkdirSync(join(root,'nested'));
    copyFileSync('public/models/lounge-sofa.glb',join(root,'models/lounge-sofa.glb'));
    await verifyAssets(root);
    writeFileSync(join(root,'nested/broken.glb'),rigFixture((_,bin)=>bin[36]=244));
    await assert.rejects(verifyAssets(root), /ACCESSOR_JOINTS_INDEX_OOB/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('GOTO reaches both floor edges and lifecycle targets beyond the boids inset at 30 and 60 FPS', () => {
  for (const fps of [30,60]) for (const [x,z] of [[29.8,0],[-30,0],[0,30],[0,-30],[0,31],[0,28]]) {
    const p=new Float32Array([0,0,0,1]),v=new Float32Array(4),s=new Float32Array([x,0,z,AgentBehavior.GOTO]);
    const obstacles=[];
    for(let i=0;i<fps*20;i++) stepCPUAgents(p,v,s,1/fps,{speed:.025,worldSize:30,separationRadius:.8,separationStrength:.05},obstacles);
    assert.ok(Math.hypot(p[0]-x,p[2]-z)<.3, `${fps} FPS target ${x},${z}: ${p}`);
  }
});

test('WebGL manager caps initial and changed populations before allocating matching buffers', async () => {
  const scene=new T.Scene(), manager=new CharacterManager(scene);
  manager.setInstanceCount(2000);
  assert.equal(manager.getCount(),WEBGPU_AGENT_LIMIT);
  await manager.load(false);
  assert.equal(manager.getCount(),WEBGL_AGENT_LIMIT);
  assert.equal(manager.getCPUPositions()!.length,WEBGL_AGENT_LIMIT*4);
  assert.equal(scene.children.length,WEBGL_AGENT_LIMIT);
  manager.setInstanceCount(10);assert.equal(scene.children.length,10);
  manager.setInstanceCount(2000);
  assert.equal(manager.getCount(),WEBGL_AGENT_LIMIT);
  assert.equal(manager.getCPUPositions()!.length,WEBGL_AGENT_LIMIT*4);
  assert.equal(scene.children.length,WEBGL_AGENT_LIMIT);
  manager.dispose();assert.equal(scene.children.length,0);
});

test('direct WebGL renderer construction cannot bypass the allocation cap', () => {
  const scene=new T.Scene(),source=createSuitedAgent();
  const renderer=new CPUAgentRenderer(scene,source.scene,source.animations,2000,null);
  assert.equal(scene.children.length,WEBGL_AGENT_LIMIT);
  renderer.dispose();assert.equal(scene.children.length,0);
});

test('UI/store population agrees with backend limit and WebGPU retains 2000', () => {
  const previous=useStore.getState();
  try {
    previous.setInstanceCount(2000);previous.setAgentLimit(WEBGL_AGENT_LIMIT);
    assert.equal(useStore.getState().instanceCount,WEBGL_AGENT_LIMIT);
    previous.setInstanceCount(2000);assert.equal(useStore.getState().instanceCount,WEBGL_AGENT_LIMIT);
    previous.setAgentLimit(WEBGPU_AGENT_LIMIT);previous.setInstanceCount(2000);
    assert.equal(useStore.getState().instanceCount,2000);
  } finally {useStore.setState({agentLimit:previous.agentLimit,instanceCount:previous.instanceCount});}
});


test('active procedural rig provides valid skin data, required clips, agent colors and offline visibility', () => {
  const source=createSuitedAgent();
  for(const name of ['Idle','Talk','Walk','Sit']) {
    const clip=source.animations.find(clip=>clip.name===name);
    assert.ok(clip && clip.validate(), `${name} must be a valid animation`);
  }
  source.scene.traverse((object:any)=>{
    if(!object.isSkinnedMesh)return;
    const joints=object.geometry.getAttribute('skinIndex');
    const weights=object.geometry.getAttribute('skinWeight');
    assert.ok(Array.from(joints.array as ArrayLike<number>).every(j=>Number.isInteger(j)&&j>=0&&j<object.skeleton.bones.length));
    assert.ok(Array.from(weights.array as ArrayLike<number>).every(w=>Number.isFinite(w)&&w>=0));
  });
  const scene=new T.Scene(), renderer=new CPUAgentRenderer(scene,source.scene,source.animations,2,['#ff0000','#0000ff']);
  renderer.update(.1,new Float32Array([2,0,3,1,4,0,5,1]),new Float32Array([0,0,1,0,1,0,0,0]),new Float32Array([0,0,0,AgentBehavior.BOIDS,0,0,0,AgentBehavior.OFFLINE]),new Float32Array(8));
  assert.deepEqual(scene.children[0].position.toArray(),[2,0,3]);
  assert.equal(scene.children[1].visible,false);
  assert.equal((scene.children[0].getObjectByName('Suit') as T.Mesh).material.color.getHexString(),'ff0000');
  renderer.dispose();assert.equal(scene.children.length,0);
});
