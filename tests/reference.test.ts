import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three/webgpu';
import { createSuitedAgent } from '../src/three/entities/createSuitedAgent';
import { CPUAgentRenderer } from '../src/three/entities/CPUAgentRenderer';
import { findOfficeRoute } from '../src/three/behavior/navigation';
import { stepCPUAgents } from '../src/three/behavior/cpuMovement';
import { OFFICE_SLOTS, PHYSICAL_OBSTACLES } from '../src/data/officeLayout';
import { AgentBehavior } from '../src/types';

test('new suited rig has finite skinned geometry and independent walking/seated clones',()=>{
 const source=createSuitedAgent();const scene=new T.Scene();const crowd=new CPUAgentRenderer(scene,source.scene,source.animations,2,null);
 crowd.update(.4,new Float32Array([0,0,0,1,3,-.30,0,1]),new Float32Array([0,0,1,0,0,0,1,0]),new Float32Array([0,0,0,AgentBehavior.BOIDS,0,0,0,AgentBehavior.SIT]),new Float32Array(8));
 const legs=scene.children.map(root=>root.getObjectByName('LeftLeg') as T.Bone);
 assert.notEqual(legs[0],legs[1]);assert.ok(Math.abs(legs[1].rotation.x+1)<.01);assert.ok(Math.abs(legs[0].rotation.x)<.5);
 let vertices=0;scene.updateMatrixWorld(true);scene.traverse((o:any)=>{if(!o.isSkinnedMesh)return;o.skeleton.update();assert.ok(Array.from(o.skeleton.boneMatrices as Float32Array).every(Number.isFinite));assert.equal(o.material.opacity,1);assert.equal(o.material.transparent,false);for(let i=0;i<o.geometry.attributes.position.count;i++){const p=new T.Vector3();o.getVertexPosition(i,p);assert.ok(p.toArray().every(Number.isFinite));vertices++;}});
 assert.ok(vertices>1000);crowd.dispose();assert.equal(scene.children.length,0);
});
test('all reference task slots stay clear of furnishing and wall collision envelopes',()=>{
 assert.equal(new Set(OFFICE_SLOTS.map(s=>s.id)).size,OFFICE_SLOTS.length);
 for(const s of OFFICE_SLOTS){assert.ok(Math.abs(s.position.x)<29&&Math.abs(s.position.z)<29,s.id);for(const o of PHYSICAL_OBSTACLES)assert.ok(s.position.distanceTo(o.position)>o.radius+.4,`${s.id} overlaps obstacle at ${o.position.toArray()}`);}
});
test('partition routes reach destination through the open end instead of crossing glazing',()=>{
 const obstacles=Array.from({length:17},(_,i)=>({position:{x:0,z:-4+i*.5},radius:.3}));
 const route=findOfficeRoute({x:-3,z:0},{x:3,z:0},obstacles,10);assert.ok(route.some(p=>Math.abs(p.z)>4));
 const p=new Float32Array([-3,0,0,1]),v=new Float32Array(4),s=new Float32Array([3,0,0,AgentBehavior.GOTO]);
 for(let n=0;n<1000;n++){stepCPUAgents(p,v,s,1/60,{speed:.025,worldSize:11,separationRadius:.8,separationStrength:.05},obstacles);for(const o of obstacles)assert.ok(Math.hypot(p[0]-o.position.x,p[2]-o.position.z)>.65);}
 assert.ok(Math.hypot(p[0]-3,p[2])<.25);
});
