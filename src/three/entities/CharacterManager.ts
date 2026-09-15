
import * as THREE from 'three/webgpu';
import { useStore } from '../../store/useStore';
import { clampAgentCount, WEBGL_AGENT_LIMIT, WEBGPU_AGENT_LIMIT } from './populationLimits';
import { createSuitedAgent } from './createSuitedAgent';
import {
  Fn,
  instanceIndex,
  storage,
  float,
  vec3,
  vec4,
  mat3,
  mat4,
  uint,
  If,
  Loop,
  uniform,
  atan,
  attribute,
  positionLocal,
  time,
  texture,
  sin,
  cos,
  uv,
  normalLocal,
  transformNormalToView,
  vec2
} from 'three/tsl';
import { BoidsParams, AgentBehavior, ExpressionKey } from '../../types';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { ExpressionBuffer } from '../behavior/ExpressionBuffer';
import { AGENTS, PLAYER_INDEX } from '../../data/agents';
import { PHYSICAL_OBSTACLES } from '../../data/officeLayout';
import { TalkIndicator } from './TalkIndicator';
import { CPUAgentRenderer } from './CPUAgentRenderer';
import { stepCPUAgents } from '../behavior/cpuMovement';

export class CharacterManager {
  private instanceCount = 100;

  // Compute Buffers (GPU)
  private posAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private velAttribute: THREE.StorageInstancedBufferAttribute | null = null;
  private timeOffsetAttribute: THREE.InstancedBufferAttribute | null = null;
  private colorAttribute: THREE.InstancedBufferAttribute | null = null;
  private positionStorage: any;
  private velocityStorage: any;

  // Agent state buffer (CPU+GPU): waypoint + behavior state per instance
  private agentStateBuffer: AgentStateBuffer | null = null;

  // Expression buffer (CPU+GPU): eye and mouth UV offsets per instance
  private expressionBuffer: ExpressionBuffer | null = null;
  private talkIndicator: TalkIndicator | null = null;

  // CPU-side mirror of GPU positions (updated via GPU readback each frame)
  private debugPosArray: Float32Array | null = null;

  // Logic Nodes

  // Assets & Objects
  private instancedMeshes: THREE.Mesh[] = [];
  private meshData: { name: string; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[] = [];
  private colors: string[] | null = null;

  // Animation Data (walk = BOIDS/GOTO, idle = FROZEN, talk = TALK)
  private bakedWalkBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedIdleBuffer: THREE.StorageBufferAttribute | null = null;
  private bakedSitBuffer: THREE.StorageBufferAttribute | null = null;
  private numSitFrames = 0;
  private sitDuration = 0;
  private bakedTalkBuffer: THREE.StorageBufferAttribute | null = null;
  private numWalkFrames = 0;
  private numIdleFrames = 0;
  private numTalkFrames = 0;
  private walkDuration = 0;
  private idleDuration = 0;
  private talkDuration = 0;
  private numBones = 0;

  // Uniforms
  private uSpeed = uniform(0.015);
  private uDeltaScale = uniform(1);
  private uSeparationRadius = uniform(0.8); // Increased radius
  private uSeparationStrength = uniform(0.050); // Increased strength
  private uWorldSize = uniform(30.0);
  private worldSize = 20.0;

  public isLoaded = false;
  private cpuMode = false;
  private sourceModel: THREE.Object3D | null = null;
  private sourceClips: THREE.AnimationClip[] = [];
  private cpuRenderer: CPUAgentRenderer | null = null;
  private cpuVelocities: Float32Array | null = null;

  constructor(private scene: THREE.Scene) {}

  public async load(useGPU = true) {
    this.cpuMode = !useGPU;
    this.instanceCount = clampAgentCount(this.instanceCount, this.cpuMode ? WEBGL_AGENT_LIMIT : WEBGPU_AGENT_LIMIT);

    try {
      const gltf = createSuitedAgent();
      const model = gltf.scene;
      this.sourceModel = model;
      this.sourceClips = gltf.animations;

      const skinnedMeshes: THREE.SkinnedMesh[] = [];
      model.traverse((child) => {
        if ((child as any).isSkinnedMesh) {
          skinnedMeshes.push(child as THREE.SkinnedMesh);
        }
      });

      const walkClip = gltf.animations.find(clip => /^walk$/i.test(clip.name)) ?? gltf.animations[2];
      const talkClip = gltf.animations.find(clip => /^talk$/i.test(clip.name)) ?? gltf.animations[1];
      const idleClip = gltf.animations.find(clip => /^idle$/i.test(clip.name)) ?? gltf.animations[0];
      if (skinnedMeshes.length === 0 || !walkClip) throw new Error("Character rig or walk animation is missing.");

      this.meshData = skinnedMeshes.map(m => ({
        name: m.name,
        geometry: m.geometry,
        material: m.material as THREE.MeshStandardMaterial
      }));

      if (this.cpuMode) {
        this.initInstances();
        this.isLoaded = true;
        return;
      }

      const firstMesh = skinnedMeshes[0];

      const walkData = this.bakeAnimation(firstMesh, walkClip, model);
      this.bakedWalkBuffer = walkData.buffer;
      this.numWalkFrames = walkData.numFrames;
      this.walkDuration = walkData.duration;
      this.numBones = walkData.numBones;

      if (idleClip) {
        const idleData = this.bakeAnimation(firstMesh, idleClip, model);
        this.bakedIdleBuffer = idleData.buffer;
        this.numIdleFrames = idleData.numFrames;
        this.idleDuration = idleData.duration;
      } else {
        this.bakedIdleBuffer = this.bakedWalkBuffer;
        this.numIdleFrames = this.numWalkFrames;
        this.idleDuration = this.walkDuration;
      }

      if (talkClip) {
        const talkData = this.bakeAnimation(firstMesh, talkClip, model);
        this.bakedTalkBuffer = talkData.buffer;
        this.numTalkFrames = talkData.numFrames;
        this.talkDuration = talkData.duration;
      } else {
        this.bakedTalkBuffer = this.bakedIdleBuffer;
        this.numTalkFrames = this.numIdleFrames;
        this.talkDuration = this.idleDuration;
      }
      const sitClip = gltf.animations.find(clip => clip.name === 'Sit')!;
      const sitData = this.bakeAnimation(firstMesh, sitClip, model);
      this.bakedSitBuffer = sitData.buffer;
      this.numSitFrames = sitData.numFrames;
      this.sitDuration = sitData.duration;
      this.initInstances();
      this.isLoaded = true;
    } catch (err) {
      throw new Error("The character model could not load. Please reload to retry.");
    }
  }

  public setInstanceCount(count: number) {
    count = clampAgentCount(count, this.cpuMode ? WEBGL_AGENT_LIMIT : WEBGPU_AGENT_LIMIT);
    if (this.instanceCount === count) return;
    this.instanceCount = count;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }

  public updateBoidsParams(params: BoidsParams) {
    this.uSpeed.value = params.speed;
    this.uSeparationRadius.value = params.separationRadius;
    this.uSeparationStrength.value = params.separationStrength;
  }

  public updateWorldSize(size: number) {
    this.uWorldSize.value = size;
    this.worldSize = size;
  }

  public updateSpeedMultiplier(mult: number) {
    const baseSpeed = useStore.getState().boidsParams.speed;
    this.uSpeed.value = baseSpeed * mult;
  }

  /**
   * Reads back the GPU position buffer to CPU.
   * Must be called after renderer.compute() each frame.
   * Returns the updated positions (1-frame GPU lag).
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    // Both backends use the same obstacle-aware movement, with no readback lag.
    return this.debugPosArray;
  }

  public update(delta: number, renderer: any) {
    this.uDeltaScale.value = Math.min(delta * 60, 3);
    if (this.expressionBuffer) {
      this.expressionBuffer.update(delta);
    }
    if (this.debugPosArray && this.cpuVelocities && this.agentStateBuffer && this.expressionBuffer) {
      stepCPUAgents(this.debugPosArray, this.cpuVelocities, this.agentStateBuffer.array, delta, {
        speed: this.uSpeed.value, worldSize: this.worldSize,
        separationRadius: this.uSeparationRadius.value, separationStrength: this.uSeparationStrength.value,
      }, PHYSICAL_OBSTACLES);
      if (!this.cpuMode && this.posAttribute && this.velAttribute) {
        this.posAttribute.array.set(this.debugPosArray);
        this.velAttribute.array.set(this.cpuVelocities);
        this.posAttribute.needsUpdate = this.velAttribute.needsUpdate = true;
      }
      this.cpuRenderer?.update(delta, this.debugPosArray, this.cpuVelocities, this.agentStateBuffer.array, this.expressionBuffer.array);
      return;
    }

  }

  public dispose() {
    this.cleanupInstances();
    const skeletons=new Set<THREE.Skeleton>();
    this.sourceModel?.traverse((o:any)=>{if(o.skeleton)skeletons.add(o.skeleton);});
    skeletons.forEach(s=>s.dispose());
    this.meshData.forEach(({geometry,material})=>{geometry.dispose();material.dispose();});
    this.meshData=[];this.sourceModel=null;
  }

  private cleanupInstances() {
    this.cpuRenderer?.dispose();
    this.cpuRenderer = null;
    this.cpuVelocities = null;
    for (const mesh of this.instancedMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => material.dispose());
    }
    this.instancedMeshes = [];
    this.expressionBuffer = null;
    if (this.talkIndicator) {
      this.talkIndicator.dispose();
      this.talkIndicator = null;
    }
  }

  private initInstances() {
    if (this.meshData.length === 0) return;

    const posArray = new Float32Array(this.instanceCount * 4);
    const velArray = new Float32Array(this.instanceCount * 4);
    const timeOffsetArray = new Float32Array(this.instanceCount);
    const colorArray = new Float32Array(this.instanceCount * 3);

    const tempColor = new THREE.Color();
    const spawnRadius = this.worldSize;

    for (let i = 0; i < this.instanceCount; i++) {
      const agent = AGENTS[i] || AGENTS[0];
      const colorOverride = this.colors && this.colors[i] ? this.colors[i] : agent.color;

      if (i === PLAYER_INDEX) {
        // Player spawns slightly offset from center so they're clearly visible
        posArray[i * 4 + 0] = 0;
        posArray[i * 4 + 2] = 0;
        posArray[i * 4 + 3] = 1;
        tempColor.set(this.colors?.[i] ?? ['#26343f','#1e2932','#34383a','#243c39'][i % 4]);
      } else {
        posArray[i * 4 + 0] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 2] = (Math.random() - 0.5) * spawnRadius * 2;
        posArray[i * 4 + 3] = 1;
        velArray[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
        velArray[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
        tempColor.set(this.colors?.[i] ?? ['#26343f','#1e2932','#34383a','#243c39'][i % 4]);
      }

      // Spawn in circulation space rather than inside furniture/partitions.
      if(i !== PLAYER_INDEX)for(let attempt=0;attempt<50;attempt++){
        if(!PHYSICAL_OBSTACLES.some(o=>Math.hypot(posArray[i*4]-o.position.x,posArray[i*4+2]-o.position.z)<o.radius+.8))break;
        posArray[i*4]=(Math.random()-.5)*Math.min(spawnRadius,28)*2;
        posArray[i*4+2]=(Math.random()-.5)*Math.min(spawnRadius,28)*2;
      }
      timeOffsetArray[i] = Math.random() * 10;
      colorArray[i * 3 + 0] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    this.debugPosArray = new Float32Array(posArray);
    this.cpuVelocities = velArray;

    if (this.cpuMode && this.sourceModel) {
      this.cpuVelocities = velArray;
      this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
      this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
      this.expressionBuffer = new ExpressionBuffer(this.instanceCount);
      this.cpuRenderer = new CPUAgentRenderer(this.scene, this.sourceModel, this.sourceClips, this.instanceCount, this.colors);
      this.cpuRenderer.update(0, this.debugPosArray, velArray, this.agentStateBuffer.array, this.expressionBuffer.array);
      return;
    }

    this.posAttribute = new THREE.StorageInstancedBufferAttribute(posArray, 4);
    this.velAttribute = new THREE.StorageInstancedBufferAttribute(velArray, 4);
    this.timeOffsetAttribute = new THREE.InstancedBufferAttribute(timeOffsetArray, 1);
    this.colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);

    this.positionStorage = storage(this.posAttribute, 'vec4', this.instanceCount);
    this.velocityStorage = storage(this.velAttribute, 'vec4', this.instanceCount);

    // Agent state buffer — player starts FROZEN, NPCs start BOIDS (0 = default)
    // Create BEFORE initComputeNode so the storage node is ready, and set
    // needsUpdate AFTER the attribute is constructed to force the initial upload.
    this.agentStateBuffer = new AgentStateBuffer(this.instanceCount);
    this.agentStateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);

    this.expressionBuffer = new ExpressionBuffer(this.instanceCount);
    this.talkIndicator = new TalkIndicator(this.scene, this.instanceCount);


    this.createInstancedMesh();
    
    this.talkIndicator.setBuffers(this.agentStateBuffer.storageNode, this.positionStorage);
  }

  private createInstancedMesh() {
    for (const { name, geometry, material: baseMaterial } of this.meshData) {
      const instancedGeometry = new THREE.InstancedBufferGeometry();
      instancedGeometry.copy(geometry as any);
      instancedGeometry.instanceCount = this.instanceCount;

      // Solo dejamos el atributo que NO se calcula en el Compute Shader
      if (this.timeOffsetAttribute) instancedGeometry.setAttribute('instanceTimeOffset', this.timeOffsetAttribute);
      if (this.colorAttribute) instancedGeometry.setAttribute('instanceColor', this.colorAttribute);

      const material = new THREE.MeshStandardNodeMaterial();
      material.roughness = baseMaterial.roughness;
      material.metalness = baseMaterial.metalness;
      material.color.copy(baseMaterial.color);
      // Solid skin, cloth and hair remain opaque, even without a texture map.
      // The previous eye-atlas branch made every untextured non-body mesh invisible.
      if (name === 'Suit') material.colorNode = attribute('instanceColor', 'vec3');
      if (name === 'Skin' || name === 'Hair') material.colorNode = vec3(baseMaterial.color.r,baseMaterial.color.g,baseMaterial.color.b).mul(float(.72).add(instanceIndex.mod(4).toFloat().mul(.12)));

      // Use the SAME node instance for both main pass and shadow depth pass.
      // castShadowPositionNode is the r183 WebGPU-specific API that overrides the
      // position used in the shadow depth pass. Setting it explicitly alongside
      // positionNode ensures the shadow pass always uses our compute-driven positions.
      const vertexNode = this.createVertexNode();
      material.positionNode = vertexNode;
      material.normalNode = transformNormalToView(this.createVertexNode(true));
      (material as any).castShadowPositionNode = vertexNode;

      const instancedMesh = new THREE.Mesh(instancedGeometry, material);
      instancedMesh.frustumCulled = false;
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;
      this.scene.add(instancedMesh);
      this.instancedMeshes.push(instancedMesh);
    }
  }

  private createVertexNode(normal = false) {
    return Fn(() => {
      const instancePos = this.positionStorage.element(instanceIndex).xyz;
      const rawVel = this.velocityStorage.element(instanceIndex).xyz;
      const timeOffset = attribute('instanceTimeOffset');

      // When velocity is zero (FROZEN/GOTO-arrived) atan(0,0) = NaN breaks the mesh.
      // Fall back to facing +Z so the rotation matrix is always valid.
      const isMoving = rawVel.length().greaterThan(float(0.001));
      const safeVel = vec3(0, 0, 1).toVar();
      If(isMoving, () => { safeVel.assign(rawVel); });

      const angle = atan(safeVel.z, safeVel.x).negate().add(float(Math.PI / 2));
      const rotationMat = mat3(
        vec3(cos(angle), float(0), sin(angle).negate()),
        vec3(float(0), float(1), float(0)),
        vec3(sin(angle), float(0), cos(angle))
      );

      const finalPosition = (normal ? normalLocal : positionLocal).toVar();

      if (this.bakedWalkBuffer && this.bakedIdleBuffer && this.bakedTalkBuffer) {
        const walkBuffer = storage(this.bakedWalkBuffer, 'mat4', this.numWalkFrames * this.numBones);
        const idleBuffer = storage(this.bakedIdleBuffer, 'mat4', this.numIdleFrames * this.numBones);
        const talkBuffer = storage(this.bakedTalkBuffer, 'mat4', this.numTalkFrames * this.numBones);
        const sitBuffer = storage(this.bakedSitBuffer!, 'mat4', this.numSitFrames * this.numBones);
        const agentState = this.agentStateBuffer!.storageNode.element(instanceIndex).w;

        const skinIndex = attribute('skinIndex');
        const skinWeight = attribute('skinWeight');
        const skinMat = mat4(0).toVar();

        // Animation selection based on AgentBehavior
        const isFrozen = agentState.greaterThan(float(0.5)).and(agentState.lessThan(float(1.5)));
        const isGoto = agentState.greaterThan(float(1.5)).and(agentState.lessThan(float(2.5)));
        const isTalk = agentState.greaterThan(float(2.5)).and(agentState.lessThan(float(3.5)));
        const isSit = agentState.greaterThan(float(3.5)).and(agentState.lessThan(float(4.5)));
        const isWorkout = agentState.greaterThan(float(4.5)).and(agentState.lessThan(float(5.5)));
        const isRegistering = agentState.greaterThan(float(5.5)).and(agentState.lessThan(float(6.5)));
        const isOffline = agentState.greaterThan(float(6.5));

        const buildSkinMat = (animBuf: any, numFrames: number, duration: number, speedMult: any = float(1.0)) => {
          const animTime = time.add(timeOffset).mul(speedMult);
          const t = animTime.div(float(duration)).fract();
          const currentFrame = t.mul(float(numFrames)).toInt();
          const safeFrame = currentFrame.min(uint(numFrames - 1));
          const addInfluence = (boneIdxNode: any, weightNode: any) => {
            If(weightNode.greaterThan(0), () => {
              const address = safeFrame.mul(uint(this.numBones)).add(boneIdxNode.toInt());
              skinMat.addAssign(animBuf.element(address).mul(weightNode));
            });
          };
          addInfluence(skinIndex.x, skinWeight.x);
          addInfluence(skinIndex.y, skinWeight.y);
          addInfluence(skinIndex.z, skinWeight.z);
          addInfluence(skinIndex.w, skinWeight.w);
        };

        If(isSit, () => {
          buildSkinMat(sitBuffer, this.numSitFrames, this.sitDuration);
        }).ElseIf(isFrozen, () => {
          buildSkinMat(idleBuffer, this.numIdleFrames, this.idleDuration);
        }).ElseIf(isTalk.or(isRegistering), () => {
          buildSkinMat(talkBuffer, this.numTalkFrames, this.talkDuration);
        }).ElseIf(isWorkout, () => {
          buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration, float(2.0)); // Run faster
        }).Else(() => {
          buildSkinMat(walkBuffer, this.numWalkFrames, this.walkDuration);
        });

        finalPosition.assign(skinMat.mul(vec4(normal ? normalLocal : positionLocal, normal ? 0.0 : 1.0)).xyz);

        // Scale to 0 if offline
        If(isOffline, () => {
          if (!normal) finalPosition.assign(vec3(0));
        });
      }

      return normal ? rotationMat.mul(finalPosition).normalize() : rotationMat.mul(finalPosition).add(instancePos);
    })();
  }

  private bakeAnimation(mesh: THREE.SkinnedMesh, clip: THREE.AnimationClip, root: THREE.Object3D) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const skeleton = mesh.skeleton;
    const duration = clip.duration;
    const numFrames = Math.ceil(duration * 60);
    const numBones = skeleton.bones.length;
    const data = new Float32Array(numFrames * numBones * 16);
    for (let f = 0; f < numFrames; f++) {
      mixer.setTime((f / numFrames) * duration);
      root.updateMatrixWorld(true);
      skeleton.update();
      for (let b = 0; b < numBones; b++) {
        const i = (f * numBones + b) * 16;
        for (let k = 0; k < 16; k++) data[i + k] = skeleton.boneMatrices[b * 16 + k];
      }
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    skeleton.pose();
    root.updateMatrixWorld(true);
    return {
      buffer: new THREE.StorageBufferAttribute(data, 16),
      numFrames,
      numBones,
      duration,
    };
  }

  public fadeToAction(name: string) {}
  public getCount() { return this.instanceCount; }

  /** Exposes the agent state buffer so BehaviorManager can read/write states. */
  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.agentStateBuffer;
  }

  /** Returns the current CPU-tracked positions buffer (vec4 stride). Updated each simulateOnCPU call. */
  public getCPUPositions(): Float32Array | null {
    return this.debugPosArray;
  }

  /** Returns the world position of a single character from the CPU buffer. */
  public getCPUPosition(index: number): THREE.Vector3 | null {
    if (!this.debugPosArray || index < 0 || index >= this.instanceCount) return null;
    const i = index * 4;
    return new THREE.Vector3(this.debugPosArray[i], this.debugPosArray[i + 1], this.debugPosArray[i + 2]);
  }

  public getAgentState(index: number): number {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return 0;
    return this.agentStateBuffer.getState(index);
  }

  public getAgentWaypoint(index: number): { x: number; z: number } {
    if (!this.agentStateBuffer || index < 0 || index >= this.instanceCount) return { x: 0, z: 0 };
    return this.agentStateBuffer.getWaypoint(index);
  }

  public setExpression(index: number, name: ExpressionKey) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setExpression(index, name);
    }
  }

  public setSpeaking(index: number, isSpeaking: boolean) {
    if (this.expressionBuffer) {
      this.expressionBuffer.setSpeaking(index, isSpeaking);
    }
    if (this.agentStateBuffer) {
      if (isSpeaking) {
        const currentState = this.agentStateBuffer.getState(index);
        // Solo cambiamos el estado de animación a TALK si no se está moviendo (GOTO/BOIDS)
        if (currentState !== AgentBehavior.GOTO && currentState !== AgentBehavior.BOIDS) {
          this.agentStateBuffer.setState(index, AgentBehavior.TALK);
        }
      } else {
        // Al dejar de hablar volvemos a FROZEN si estábamos en estado TALK
        if (this.agentStateBuffer.getState(index) === AgentBehavior.TALK) {
          this.agentStateBuffer.setState(index, AgentBehavior.FROZEN);
        }
      }
    }
  }

  public setColors(hexColors: string[]) {
    this.colors = hexColors;
    if (this.isLoaded) {
      this.cleanupInstances();
      this.initInstances();
    }
  }
}
