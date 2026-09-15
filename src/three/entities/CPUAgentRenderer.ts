import * as THREE from 'three/webgpu';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { agentSurface } from '../../data/agentAppearance';
import { AgentBehavior } from '../../types';
import { clampAgentCount, WEBGL_AGENT_LIMIT } from './populationLimits';

/** Standard skinned meshes avoid WebGPU storage-buffer shaders on WebGL2. */
export class CPUAgentRenderer {
  private agents: { root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; current: string; faces: { map: THREE.Texture; offset: number }[] }[] = [];

  constructor(private scene: THREE.Scene, source: THREE.Object3D, clips: THREE.AnimationClip[], count: number, colors: string[] | null) {
    for (let i = 0; i < clampAgentCount(count, WEBGL_AGENT_LIMIT); i++) {
      const root = clone(source);
      root.scale.setScalar(agentSurface(i,'Suit').height);
      const faces: { map: THREE.Texture; offset: number }[] = [];
      root.traverse((object: any) => {
        if (!object.isMesh) return;
        object.castShadow = true; object.receiveShadow = true;
        // Animated limbs can leave the rest-pose bounding box.
        object.frustumCulled = false;
        const materials = (Array.isArray(object.material) ? object.material : [object.material]).map((original: THREE.MeshStandardMaterial) => {
          const material = original.clone();
          const surface=agentSurface(i,object.name,colors?.[i]);
          if(surface.color)material.color.set(surface.color);
          object.visible=surface.visible;
          const name = object.name.toLowerCase();
          if (material.map && (name.includes('eyes') || name.includes('mouth'))) {
            material.map = material.map.clone();
            faces.push({ map: material.map, offset: name.includes('eyes') ? 0 : 2 });
          }
          return material;
        });
        object.material = Array.isArray(object.material) ? materials : materials[0];
      });
      const mixer = new THREE.AnimationMixer(root);
      const actions: Record<string, THREE.AnimationAction> = {};
      for (const name of ['Idle', 'Talk', 'Walk', 'Sit', 'Coffee']) {
        const clip = clips.find(c => c.name.toLowerCase() === name.toLowerCase()) ?? clips[0];
        if (clip) actions[name] = mixer.clipAction(clip);
      }
      actions.Idle?.play(); mixer.setTime(Math.random() * (actions.Idle?.getClip().duration || 1));
      this.agents.push({ root, mixer, actions, current: 'Idle', faces });
      scene.add(root);
    }
  }

  update(delta: number, positions: Float32Array, velocities: Float32Array, states: Float32Array, expressions: Float32Array) {
    this.agents.forEach((agent, i) => {
      const k = i * 4, state = states[k + 3];
      agent.root.visible = state !== AgentBehavior.OFFLINE;
      if (!agent.root.visible) return;
      agent.root.position.set(positions[k], positions[k + 1], positions[k + 2]);
      if (Math.hypot(velocities[k], velocities[k + 2]) > .001) agent.root.rotation.y = Math.atan2(velocities[k], velocities[k + 2]);
      const moving = state === AgentBehavior.BOIDS || state === AgentBehavior.WORKOUT || (state === AgentBehavior.GOTO && Math.hypot(states[k] - positions[k], states[k + 2] - positions[k + 2]) > .2);
      const cup=agent.root.getObjectByName('CoffeeCup');
      if(cup)cup.visible = state === AgentBehavior.COFFEE;
      const next = state === AgentBehavior.COFFEE ? 'Coffee' : state === AgentBehavior.SIT ? 'Sit' : moving ? 'Walk' : state === AgentBehavior.TALK || state === AgentBehavior.REGISTERING ? 'Talk' : 'Idle';
      if (next !== agent.current) {
        agent.actions[agent.current]?.fadeOut(.15);
        agent.actions[next]?.reset().fadeIn(.15).play();
        agent.current = next;
      }
      agent.mixer.timeScale = state === AgentBehavior.WORKOUT ? 2 : 1;
      agent.mixer.update(delta);
      agent.faces.forEach(face => face.map.offset.set(expressions[k + face.offset], expressions[k + face.offset + 1]));
    });
  }

  dispose() {
    for (const agent of this.agents) {
      this.scene.remove(agent.root);
      agent.mixer.stopAllAction(); agent.mixer.uncacheRoot(agent.root);
      agent.faces.forEach(face => face.map.dispose());
      agent.root.traverse((object: any) => {
        if (object.isSkinnedMesh) object.skeleton.dispose();
        if (object.isMesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m: THREE.Material) => m.dispose());
      });
    }
    this.agents = [];
  }
}
