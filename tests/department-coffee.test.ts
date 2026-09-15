import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { AGENTS } from '../src/data/agents';
import { DEPARTMENT_LOOKS, agentAppearance, agentSurface } from '../src/data/agentAppearance';
import { createSuitedAgent } from '../src/three/entities/createSuitedAgent';
import { CPUAgentRenderer } from '../src/three/entities/CPUAgentRenderer';
import { AgentStateBuffer } from '../src/three/behavior/AgentStateBuffer';
import { CoffeeBreaks } from '../src/three/behavior/CoffeeBreaks';
import { stepCPUAgents } from '../src/three/behavior/cpuMovement';
import { AgentBehavior } from '../src/types';
import { PHYSICAL_OBSTACLES } from '../src/data/officeLayout';

test('all six departments have coherent distinct clothes on the actual default rigs',()=>{
  assert.equal(new Set(Object.values(DEPARTMENT_LOOKS).map(d=>d.suit)).size,6);
  const source=createSuitedAgent(),scene=new T.Scene(),crowd=new CPUAgentRenderer(scene,source.scene,source.animations,10,null);
  for(let i=0;i<10;i++){
    const a=agentAppearance(i),root=scene.children[i];
    assert.equal((root.getObjectByName('Suit') as T.Mesh).material.color.getHexString(),a.suit.slice(1));
    for(const name of ['Waistcoat','Scarf','Lanyard','PocketSquare','Glasses','HairBun'])assert.equal(root.getObjectByName(name)!.visible,agentSurface(i,name).visible);
    assert.equal(root.scale.y,a.height);
  }
  for(const department of Object.keys(DEPARTMENT_LOOKS)){
    const members=AGENTS.filter(a=>a.department===department).slice(0,12);
    if(members.length>1)assert.ok(new Set(members.map(a=>agentAppearance(a.index).skin)).size>1,department);
  }
  crowd.dispose();
});
test('coffee cup is skinned to the hand, reaches the mouth and hides after sipping',()=>{
  const source=createSuitedAgent(),scene=new T.Scene(),crowd=new CPUAgentRenderer(scene,source.scene,source.animations,1,null);
  const states=new Float32Array([0,0,1,AgentBehavior.COFFEE]);
  crowd.update(.6,new Float32Array([0,0,0,1]),new Float32Array([0,0,1,0]),states,new Float32Array(4));
  const root=scene.children[0],cup=root.getObjectByName('CoffeeCup') as T.SkinnedMesh;
  assert.equal(cup.visible,true);scene.updateMatrixWorld(true);cup.skeleton.update();
  const hand=new T.Vector3(0,-.57,.1).applyMatrix4(root.getObjectByName('RightForearm')!.matrixWorld);
  const mouth=new T.Vector3(.1,.02,.23).applyMatrix4(root.getObjectByName('Head')!.matrixWorld);
  assert.ok(hand.distanceTo(mouth)<.12,`cup distance ${hand.distanceTo(mouth)}`);
  for(let i=0;i<cup.geometry.attributes.position.count;i++)assert.ok(cup.getVertexPosition(i,new T.Vector3()).toArray().every(Number.isFinite));
  states[3]=AgentBehavior.FROZEN;crowd.update(.2,new Float32Array([0,0,0,1]),new Float32Array(4),states,new Float32Array(4));assert.equal(cup.visible,false);crowd.dispose();
});
function setup(){const buffer=new AgentStateBuffer(3),positions=new Float32Array([0,0,0,1,28,0,-7,1,28,0,-4,1]),velocities=new Float32Array(12);buffer.setState(1,AgentBehavior.FROZEN);buffer.setWaypoint(1,0,1);buffer.setState(2,AgentBehavior.FROZEN);buffer.setWaypoint(2,1,0);const coffee=new CoffeeBreaks(buffer);return {buffer,positions,coffee,tick:()=>{stepCPUAgents(positions,velocities,buffer.array,1/60,{speed:.025,worldSize:30,separationRadius:.6,separationStrength:.03},PHYSICAL_OBSTACLES);coffee.update(positions,1/60);}};}
test('a real navigation trip queues colleagues, waits for overlapping calls, sips and restores their tasks',()=>{
  const s=setup(),original=Array.from(s.buffer.array);
  s.coffee.event({agentIndex:1,callId:'a',phase:'start'});s.coffee.event({agentIndex:1,callId:'b',phase:'start'});s.coffee.event({agentIndex:2,callId:'c',phase:'start'});
  s.coffee.event({agentIndex:2,callId:'c',phase:'settled'});s.tick();assert.equal(s.coffee.controls(2),false);
  for(let i=0;i<900;i++)s.tick();assert.equal(s.buffer.getState(1),AgentBehavior.COFFEE);
  s.coffee.event({agentIndex:1,callId:'a',phase:'settled'});for(let i=0;i<180;i++)s.tick();assert.equal(s.buffer.getState(1),AgentBehavior.COFFEE);
  s.coffee.event({agentIndex:1,callId:'b',phase:'settled'});let secondSipped=false;
  for(let i=0;i<2400;i++){s.tick();secondSipped ||= s.buffer.getState(2)===AgentBehavior.COFFEE;}
  assert.ok(secondSipped);assert.equal(s.coffee.queued(1),false);assert.equal(s.coffee.queued(2),false);assert.deepEqual(Array.from(s.buffer.array),original);
  assert.ok(Math.hypot(s.positions[4]-28,s.positions[6]+7)<.001);s.coffee.dispose();
});
test('rejected, fast and out-of-range calls cannot strand an agent; dispose clears trips',()=>{
  const s=setup();s.coffee.event({agentIndex:900,callId:'invalid',phase:'start'});assert.equal(s.coffee.queued(900),false);
  s.coffee.event({agentIndex:1,callId:'fast',phase:'start'});s.coffee.event({agentIndex:1,callId:'fast',phase:'settled'});
  let sipped=false;for(let i=0;i<1800;i++){s.tick();sipped ||= s.buffer.getState(1)===AgentBehavior.COFFEE;}
  assert.ok(sipped);assert.equal(s.coffee.queued(1),false);
  s.coffee.event({agentIndex:1,callId:'pending',phase:'start'});s.tick();s.coffee.dispose();assert.equal(s.buffer.getState(1),AgentBehavior.FROZEN);
});

test('WebGPU consumes the same department colors, masks and Coffee animation as native WebGL',async()=>{
  const { CharacterManager }=await import('../src/three/entities/CharacterManager');
  const scene=new T.Scene(),manager=new CharacterManager(scene);manager.setInstanceCount(10);await manager.load(true);
  const meshes=scene.children.filter((o:any)=>o.isMesh&&o.geometry.getAttribute('instanceAppearance')) as T.Mesh[];
  const source=createSuitedAgent();const sourceMeshes=source.scene.children.filter((o:any)=>o.isSkinnedMesh) as T.Mesh[];
  assert.equal(meshes.length,sourceMeshes.length);
  for(let m=0;m<meshes.length;m++)for(let i=0;i<10;i++){
    const name=sourceMeshes[m].name,expected=agentSurface(i,name),attribute=meshes[m].geometry.getAttribute('instanceAppearance');
    assert.equal(attribute.getW(i),expected.visible||name==='CoffeeCup'?1:0);
    if(expected.color){const color=new T.Color(expected.color);assert.ok(Math.abs(attribute.getX(i)-color.r)<1e-6);}
  }
  assert.ok((manager as any).numCoffeeFrames>0);assert.ok(Array.from((manager as any).bakedCoffeeBuffer.array as Float32Array).every(Number.isFinite));manager.dispose();
});

test('BehaviorManager cannot overwrite an MCP trip with its normal task or chat logic',async()=>{
  const { BehaviorManager }=await import('../src/three/behavior/BehaviorManager');
  const s=setup(),manager=new BehaviorManager(s.buffer,AGENTS.slice(0,3),()=>{},()=>{},()=>{});
  manager.toolEvent({agentIndex:1,callId:'integration',phase:'start'});
  manager.toolEvent({agentIndex:1,callId:'integration',phase:'settled'});
  const velocities=new Float32Array(12);let sipped=false;
  for(let i=0;i<2400;i++){
    stepCPUAgents(s.positions,velocities,s.buffer.array,1/60,{speed:.025,worldSize:30,separationRadius:.6,separationStrength:.03},PHYSICAL_OBSTACLES);
    manager.update(s.positions,1/60);
    if(manager.coffee.controls(1)){const before=s.buffer.getState(1);manager.startChat(1,s.positions);assert.equal(s.buffer.getState(1),before);}
    sipped ||= s.buffer.getState(1)===AgentBehavior.COFFEE;
  }
  assert.ok(sipped);assert.equal(manager.coffee.queued(1),false);manager.dispose();s.coffee.dispose();
});
