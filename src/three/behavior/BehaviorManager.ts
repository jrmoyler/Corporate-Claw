import * as THREE from 'three/webgpu';
import { AgentBehavior, ActiveEncounter } from '../../types';
import { AgentStateBuffer } from './AgentStateBuffer';
import { AgentData, PLAYER_INDEX } from '../../data/agents';
import { useStore } from '../../store/useStore';
import { OFFICE_SLOTS, FurnitureSlot } from '../../data/officeLayout';

// ── Tuning constants ─────────────────────────────────────────
const NPC_COLLISION_RADIUS = 0.8;          // world units — NPC↔NPC freeze trigger
const PLAYER_ENCOUNTER_RADIUS = 1.5;       // world units — player↔NPC chat trigger
const PLAYER_ARRIVAL_RADIUS = 0.3;         // world units — GOTO waypoint reached
const FROZEN_DURATION_MS = 4000;           // ms NPCs stay frozen after a collision
const MAX_FROZEN_PAIRS = 10;               // cap simultaneous NPC↔NPC frozen pairs
const UNFREEZE_COOLDOWN_MS = 800;          // ms after unfreeze before NPC can re-collide

interface AgentTask {
  slotId: string | null;
  targetPos: THREE.Vector3;
  targetRotation: number;
  behavior: AgentBehavior;
  expiresAt: number;
}

interface FrozenPair {
  a: number;
  b: number;
  expiresAt: number;
  talkingA: boolean;
  nextSwap: number;
}

export class BehaviorManager {
  private frozenPairs = new Map<string, FrozenPair>();
  private frozenIndices = new Set<number>();
  private unfreezeTimestamps = new Map<number, number>(); // index → time of last unfreeze
  private currentEncounterNPC: number | null = null;
  private chatNPC: number | null = null; // NPC player is currently moving to talk to
  private agentTasks = new Map<number, AgentTask>();
  private occupiedSlots = new Set<string>();

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
    private onSpeakingTrigger: (index: number, isSpeaking: boolean) => void,
    private onPlayerArrivedAtNPC: (index: number) => void,
  ) {
    // Player starts FROZEN (idle) — user activates it with a floor click (GOTO)
    stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    
    // Initialize tasks for NPCs
    this.initializeTasks();
  }

  private initializeTasks() {
    for (let i = 1; i < this.agents.length; i++) {
      this.assignNewTask(i);
    }
  }

  private assignNewTask(index: number) {
    const agent = this.agents[index];
    const now = Date.now();
    
    // Release old slot
    const oldTask = this.agentTasks.get(index);
    if (oldTask?.slotId) {
      this.occupiedSlots.delete(oldTask.slotId);
    }

    let behavior: AgentBehavior = AgentBehavior.BOIDS;
    let slotType: FurnitureSlot['type'] | null = null;
    
    const rand = Math.random();
    if (rand < 0.15) {
      slotType = 'TREADMILL';
      behavior = AgentBehavior.WORKOUT;
    } else if (agent.department === 'Production' || agent.department === 'Finance') {
      // High desk usage
      if (rand < 0.7) {
        slotType = 'DESK';
        behavior = AgentBehavior.SIT;
      } else if (rand < 0.85) {
        slotType = 'MEETING_CHAIR';
        behavior = AgentBehavior.SIT;
      } else {
        slotType = 'COFFEE_MACHINE';
        behavior = AgentBehavior.FROZEN;
      }
    } else if (agent.department === 'Sales' || agent.department === 'Marketing') {
      // High social usage
      if (rand < 0.5) {
        slotType = 'CAFE_TABLE';
        behavior = AgentBehavior.TALK;
      } else if (rand < 0.8) {
        slotType = 'MEETING_CHAIR';
        behavior = AgentBehavior.TALK;
      } else {
        slotType = 'COFFEE_MACHINE';
        behavior = AgentBehavior.FROZEN;
      }
    } else {
      // Engineering / HR / Others
      if (rand < 0.4) {
        slotType = 'DESK';
        behavior = AgentBehavior.SIT;
      } else if (rand < 0.7) {
        slotType = 'MEETING_CHAIR';
        behavior = AgentBehavior.SIT;
      } else {
        slotType = 'CAFE_TABLE';
        behavior = AgentBehavior.TALK;
      }
    }

    // Find available slot of requested type
    const availableSlots = OFFICE_SLOTS.filter(s => s.type === slotType && !this.occupiedSlots.has(s.id));
    
    let targetPos: THREE.Vector3;
    let targetRotation: number;
    let slotId: string | null = null;

    if (availableSlots.length > 0) {
      const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
      targetPos = slot.position;
      targetRotation = slot.rotation;
      slotId = slot.id;
      this.occupiedSlots.add(slotId);
    } else {
      // Fallback to random wandering if no slots available
      targetPos = new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40);
      targetRotation = Math.random() * Math.PI * 2;
      behavior = AgentBehavior.BOIDS;
    }

    this.agentTasks.set(index, {
      slotId,
      targetPos,
      targetRotation,
      behavior,
      expiresAt: now + 20000 + Math.random() * 60000 // Tasks last 20-80 seconds
    });

    this.stateBuffer.setWaypoint(index, targetPos.x, targetPos.z);
    this.stateBuffer.setState(index, AgentBehavior.GOTO);
  }

  public update(positions: Float32Array): void {
    const now = Date.now();
    const count = this.agents.length;

    // 1. Expire frozen NPC pairs
    for (const [key, pair] of this.frozenPairs) {
      if (now > pair.expiresAt) {
        const taskA = this.agentTasks.get(pair.a);
        const taskB = this.agentTasks.get(pair.b);
        this.stateBuffer.setState(pair.a, taskA?.behavior ?? AgentBehavior.BOIDS);
        this.stateBuffer.setState(pair.b, taskB?.behavior ?? AgentBehavior.BOIDS);

        this.onSpeakingTrigger(pair.a, false);
        this.onSpeakingTrigger(pair.b, false);

        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.unfreezeTimestamps.set(pair.a, now);
        this.unfreezeTimestamps.set(pair.b, now);
        this.frozenPairs.delete(key);
      } else {
        if (now > pair.nextSwap) {
          pair.talkingA = !pair.talkingA;
          pair.nextSwap = now + 1500 + Math.random() * 1500;
          this.onSpeakingTrigger(pair.a, pair.talkingA);
          this.onSpeakingTrigger(pair.b, !pair.talkingA);
        }
      }
    }

    for (const [idx, ts] of this.unfreezeTimestamps) {
      if (now - ts > UNFREEZE_COOLDOWN_MS) this.unfreezeTimestamps.delete(idx);
    }

    // 2. Detect NPC↔NPC collisions (only for those in BOIDS state)
    if (this.frozenPairs.size < MAX_FROZEN_PAIRS) {
      for (let i = 1; i < count - 1; i++) {
        if (this.frozenIndices.has(i)) continue;
        if (this.stateBuffer.getState(i) !== AgentBehavior.BOIDS) continue;
        if (this.unfreezeTimestamps.has(i)) continue;

        for (let j = i + 1; j < count; j++) {
          if (this.frozenIndices.has(j)) continue;
          if (this.stateBuffer.getState(j) !== AgentBehavior.BOIDS) continue;
          if (this.unfreezeTimestamps.has(j)) continue;

          const dx = positions[i * 4] - positions[j * 4];
          const dz = positions[i * 4 + 2] - positions[j * 4 + 2];

          if (dx * dx + dz * dz < NPC_COLLISION_RADIUS * NPC_COLLISION_RADIUS) {
            this.stateBuffer.setState(i, AgentBehavior.TALK);
            this.stateBuffer.setState(j, AgentBehavior.TALK);

            const talkingA = Math.random() > 0.5;
            this.onSpeakingTrigger(i, talkingA);
            this.onSpeakingTrigger(j, !talkingA);

            const dirX = positions[j * 4] - positions[i * 4];
            const dirZ = positions[j * 4 + 2] - positions[i * 4 + 2];
            this.stateBuffer.setWaypoint(i, dirX, dirZ);
            this.stateBuffer.setWaypoint(j, -dirX, -dirZ);

            this.frozenIndices.add(i);
            this.frozenIndices.add(j);
            const key = `${i}-${j}`;
            this.frozenPairs.set(key, {
              a: i,
              b: j,
              expiresAt: now + FROZEN_DURATION_MS,
              talkingA,
              nextSwap: now + 1500 + Math.random() * 1000
            });
            break;
          }
        }
      }
    }

    // 3. Task Management & GOTO arrival
    for (let i = 1; i < count; i++) {
      const task = this.agentTasks.get(i);
      if (!task) continue;

      const currentState = this.stateBuffer.getState(i);

      if (currentState === AgentBehavior.GOTO) {
        const pdx = task.targetPos.x - positions[i * 4];
        const pdz = task.targetPos.z - positions[i * 4 + 2];
        if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
          // Snap to exact slot position and orientation
          this.stateBuffer.setState(i, task.behavior);
          const fx = Math.sin(task.targetRotation);
          const fz = Math.cos(task.targetRotation);
          this.stateBuffer.setWaypoint(i, fx, fz);
        }
      }

      if (now > task.expiresAt && !this.frozenIndices.has(i)) {
        this.assignNewTask(i);
      }
    }

    // Player GOTO arrival
    if (this.stateBuffer.getState(PLAYER_INDEX) === AgentBehavior.GOTO) {
      const wp = this.stateBuffer.getWaypoint(PLAYER_INDEX);
      const pdx = wp.x - positions[PLAYER_INDEX * 4];
      const pdz = wp.z - positions[PLAYER_INDEX * 4 + 2];
      if (pdx * pdx + pdz * pdz < PLAYER_ARRIVAL_RADIUS * PLAYER_ARRIVAL_RADIUS) {
        this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);

        if (this.chatNPC !== null) {
          const finishedNPC = this.chatNPC;
          const nx = positions[finishedNPC * 4];
          const nz = positions[finishedNPC * 4 + 2];
          const fx = nx - positions[PLAYER_INDEX * 4];
          const fz = nz - positions[PLAYER_INDEX * 4 + 2];
          this.stateBuffer.setWaypoint(PLAYER_INDEX, fx, fz);

          useStore.getState().setAnimation('Wave');
          this.onPlayerArrivedAtNPC(finishedNPC);
          this.chatNPC = null;
        } else {
          this.stateBuffer.setWaypoint(PLAYER_INDEX, pdx, pdz);
        }
      }
    }

    // 4. Detect player↔NPC proximity (encounter)
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];
    let nearestNPC: number | null = null;
    let nearestDist2 = PLAYER_ENCOUNTER_RADIUS * PLAYER_ENCOUNTER_RADIUS;

    for (let i = 1; i < count; i++) {
      const dx = px - positions[i * 4];
      const dz = pz - positions[i * 4 + 2];
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearestNPC = i;
      }
    }

    if (nearestNPC !== this.currentEncounterNPC) {
      this.currentEncounterNPC = nearestNPC;
      if (nearestNPC !== null) {
        const agent = this.agents[nearestNPC];
        this.onEncounterChange({
          npcIndex: nearestNPC,
          npcDepartment: agent.department,
          npcRole: agent.role,
          npcMission: agent.mission,
          npcPersonality: agent.personality,
        });
      } else {
        this.onEncounterChange(null);
      }
    }
  }

  public setPlayerWaypoint(x: number, z: number): void {
    this.chatNPC = null;
    this.stateBuffer.setWaypoint(PLAYER_INDEX, x, z);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
  }

  public startChat(npcIndex: number, positions: Float32Array): void {
    const nx = positions[npcIndex * 4];
    const nz = positions[npcIndex * 4 + 2];
    const px = positions[PLAYER_INDEX * 4];
    const pz = positions[PLAYER_INDEX * 4 + 2];

    let dx = px - nx;
    let dz = pz - nz;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) {
      dx = 1; dz = 0;
    } else {
      dx /= dist; dz /= dist;
    }

    const targetX = nx + dx * 1.2;
    const targetZ = nz + dz * 1.2;

    this.stateBuffer.setWaypoint(PLAYER_INDEX, targetX, targetZ);
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.GOTO);
    this.chatNPC = npcIndex;

    this.stateBuffer.setState(npcIndex, AgentBehavior.FROZEN);
    this.stateBuffer.setWaypoint(npcIndex, dx, dz);

    for (const [key, pair] of this.frozenPairs) {
      if (pair.a === npcIndex || pair.b === npcIndex) {
        const other = pair.a === npcIndex ? pair.b : pair.a;
        const task = this.agentTasks.get(other);
        this.stateBuffer.setState(other, task?.behavior ?? AgentBehavior.BOIDS);
        this.frozenIndices.delete(pair.a);
        this.frozenIndices.delete(pair.b);
        this.frozenPairs.delete(key);
        break;
      }
    }
  }

  public endChat(npcIndex: number | null): void {
    this.chatNPC = null;
    if (npcIndex !== null) {
      const task = this.agentTasks.get(npcIndex);
      this.stateBuffer.setState(npcIndex, task?.behavior ?? AgentBehavior.BOIDS);
    }
    this.stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
  }
}
