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

interface AgentNeeds {
  energy: number;
  focus: number;
  social: number;
}

export class BehaviorManager {
  private frozenPairs = new Map<string, FrozenPair>();
  private frozenIndices = new Set<number>();
  private unfreezeTimestamps = new Map<number, number>(); // index → time of last unfreeze
  private currentEncounterNPC: number | null = null;
  private chatNPC: number | null = null; // NPC player is currently moving to talk to
  private agentTasks = new Map<number, AgentTask>();
  private agentNeeds = new Map<number, AgentNeeds>();
  private agentRegistered = new Map<number, boolean>();
  private receptionQueue: number[] = [];
  private occupiedSlots = new Set<string>();
  private lastNeedsUpdate = Date.now();
  private lastStatsUpdate = Date.now();
  private lastEventCheck = Date.now();

  constructor(
    private stateBuffer: AgentStateBuffer,
    private agents: AgentData[],
    private onEncounterChange: (encounter: ActiveEncounter | null) => void,
    private onSpeakingTrigger: (index: number, isSpeaking: boolean) => void,
    private onPlayerArrivedAtNPC: (index: number) => void,
  ) {
    // Player starts FROZEN (idle) — user activates it with a floor click (GOTO)
    stateBuffer.setState(PLAYER_INDEX, AgentBehavior.FROZEN);
    
    // Initialize tasks and needs for NPCs
    this.initializeAgents();
  }

  private initializeAgents() {
    for (let i = 1; i < this.agents.length; i++) {
      this.agentNeeds.set(i, {
        energy: 0.5 + Math.random() * 0.5,
        focus: 0.5 + Math.random() * 0.5,
        social: 0.5 + Math.random() * 0.5,
      });
      // 20% of agents start as "New" and need registration
      const needsRegistration = Math.random() < 0.2;
      this.agentRegistered.set(i, !needsRegistration);
      this.assignNewTask(i);
    }
  }

  private assignNewTask(index: number) {
    const agent = this.agents[index];
    const needs = this.agentNeeds.get(index) || { energy: 1, focus: 1, social: 1 };
    const isRegistered = this.agentRegistered.get(index) ?? true;
    const now = Date.now();
    
    // Release old slot
    const oldTask = this.agentTasks.get(index);
    if (oldTask?.slotId) {
      this.occupiedSlots.delete(oldTask.slotId);
    }

    let behavior: AgentBehavior = AgentBehavior.BOIDS;
    let slotType: FurnitureSlot['type'] | null = null;
    let targetPos: THREE.Vector3;
    let targetRotation: number;
    let slotId: string | null = null;
    
    if (!isRegistered) {
      if (!this.receptionQueue.includes(index)) {
        this.receptionQueue.push(index);
      }
      
      const queueIndex = this.receptionQueue.indexOf(index);
      const receptionSlot = OFFICE_SLOTS.find(s => s.type === 'RECEPTION');
      
      if (receptionSlot) {
        const lineOffset = queueIndex * 1.5;
        targetPos = new THREE.Vector3(
          receptionSlot.position.x,
          receptionSlot.position.y,
          receptionSlot.position.z + lineOffset
        );
        targetRotation = receptionSlot.rotation;
        slotId = queueIndex === 0 ? receptionSlot.id : `queue-${index}`;
        behavior = queueIndex === 0 ? AgentBehavior.REGISTERING : AgentBehavior.FROZEN;
        if (queueIndex === 0) this.occupiedSlots.add(slotId);
      } else {
        targetPos = new THREE.Vector3(0, 0, 24.5);
        targetRotation = 0;
        behavior = AgentBehavior.REGISTERING;
      }
    } else {
      // Decision Making based on Needs
      if (needs.energy < 0.3) {
        slotType = Math.random() > 0.5 ? 'COFFEE_MACHINE' : 'CAFE_TABLE';
        behavior = slotType === 'COFFEE_MACHINE' ? AgentBehavior.FROZEN : AgentBehavior.TALK;
      } else if (needs.focus < 0.3) {
        slotType = 'DESK';
        behavior = AgentBehavior.SIT;
      } else if (needs.social < 0.3) {
        slotType = 'CAFE_TABLE';
        behavior = AgentBehavior.TALK;
      } else {
        // Default department-based behavior
        const rand = Math.random();
        if (rand < 0.15) {
          slotType = 'TREADMILL';
          behavior = AgentBehavior.WORKOUT;
        } else if (agent.department === 'Production' || agent.department === 'Finance') {
          if (rand < 0.7) {
            slotType = 'DESK';
            behavior = AgentBehavior.SIT;
          } else {
            slotType = 'MEETING_CHAIR';
            behavior = AgentBehavior.SIT;
          }
        } else {
          if (rand < 0.5) {
            slotType = 'CAFE_TABLE';
            behavior = AgentBehavior.TALK;
          } else {
            slotType = 'MEETING_CHAIR';
            behavior = AgentBehavior.TALK;
          }
        }
      }

      // Find available slot of requested type
      const availableSlots = OFFICE_SLOTS.filter(s => s.type === slotType && !this.occupiedSlots.has(s.id));
      
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
    }

    this.agentTasks.set(index, {
      slotId,
      targetPos,
      targetRotation,
      behavior,
      expiresAt: now + (slotType === 'RECEPTION' ? 10000 : (20000 + Math.random() * 60000)) // Registration takes 10s
    });

    this.stateBuffer.setWaypoint(index, targetPos.x, targetPos.z);
    this.stateBuffer.setState(index, AgentBehavior.GOTO);
  }

  public update(positions: Float32Array): void {
    const now = Date.now();
    const count = this.agents.length;
    const { activeEvents, addWorldEvent, removeWorldEvent, updateAgentXP } = useStore.getState();

    // 0. Update Needs & XP
    if (now - this.lastNeedsUpdate > 1000) {
      const delta = (now - this.lastNeedsUpdate) / 1000;
      
      // Calculate event impacts
      let energyDecayMult = 1.0;
      let focusDecayMult = 1.0;
      let socialDecayMult = 1.0;
      
      activeEvents.forEach(event => {
        if (now > event.startTime + event.duration * 1000) {
          removeWorldEvent(event.id);
        } else {
          if (event.impact.energyDecayMult) energyDecayMult *= event.impact.energyDecayMult;
          if (event.impact.focusDecayMult) focusDecayMult *= event.impact.focusDecayMult;
          if (event.impact.socialDecayMult) socialDecayMult *= event.impact.socialDecayMult;
        }
      });

      for (let i = 1; i < count; i++) {
        const needs = this.agentNeeds.get(i);
        if (needs) {
          const state = this.stateBuffer.getState(i);
          // Decay
          needs.energy -= 0.005 * delta * energyDecayMult;
          needs.focus -= 0.008 * delta * focusDecayMult;
          needs.social -= 0.006 * delta * socialDecayMult;

          // Recovery based on state
          let xpGain = 0;
          if (state === AgentBehavior.SIT) {
            needs.focus += 0.02 * delta;
            xpGain = 0.5;
          }
          if (state === AgentBehavior.TALK) {
            needs.social += 0.03 * delta;
            xpGain = 0.8;
          }
          if (state === AgentBehavior.FROZEN) {
            needs.energy += 0.04 * delta;
            xpGain = 0.2;
          }
          if (state === AgentBehavior.WORKOUT) {
            needs.energy -= 0.02 * delta;
            needs.focus += 0.01 * delta;
            xpGain = 1.2;
          }

          if (xpGain > 0) {
            updateAgentXP(i, xpGain * delta);
          }

          // Clamp
          needs.energy = Math.max(0, Math.min(1, needs.energy));
          needs.focus = Math.max(0, Math.min(1, needs.focus));
          needs.social = Math.max(0, Math.min(1, needs.social));
        }
      }
      this.lastNeedsUpdate = now;
    }

    // 0.05 Trigger Random Events
    if (now - this.lastEventCheck > 30000) { // Every 30s
      if (Math.random() < 0.3) {
        const eventTypes = [
          { name: 'Coffee Machine Breakdown', desc: 'The machines are leaking! Energy recovery is halved.', type: 'NEGATIVE', impact: { energyDecayMult: 2.0 } },
          { name: 'Market Boom', desc: 'Corporate Claw stock is up! Everyone is moving faster.', type: 'POSITIVE', impact: { speedMult: 1.5, successRateMult: 1.2 } },
          { name: 'System Maintenance', desc: 'The internal network is slow. Focus recovery is harder.', type: 'NEUTRAL', impact: { focusDecayMult: 1.8 } },
          { name: 'Happy Hour', desc: 'Mandatory fun in the cafe! Social needs decay slower.', type: 'POSITIVE', impact: { socialDecayMult: 0.5 } }
        ];
        const selected = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        addWorldEvent({
          id: `event-${now}`,
          name: selected.name,
          description: selected.desc,
          type: selected.type as any,
          duration: 60,
          startTime: now,
          impact: selected.impact
        });
      }
      this.lastEventCheck = now;
    }

    // 0.1 Update Company Stats periodically
    if (now - this.lastStatsUpdate > 5000) {
      let totalEfficiency = 0;
      let totalUtilization = 0;
      const deptPerformance: Record<string, number> = {
        'Production': 0, 'Sales': 0, 'Marketing': 0, 'Finance': 0
      };
      const deptCounts: Record<string, number> = {
        'Production': 0, 'Sales': 0, 'Marketing': 0, 'Finance': 0
      };

      for (let i = 1; i < count; i++) {
        const needs = this.agentNeeds.get(i);
        const agent = this.agents[i];
        if (needs && agent) {
          const efficiency = (needs.energy + needs.focus + needs.social) / 3;
          totalEfficiency += efficiency;
          
          const state = this.stateBuffer.getState(i);
          if (state !== AgentBehavior.BOIDS) {
            totalUtilization++;
          }

          if (deptPerformance[agent.department] !== undefined) {
            deptPerformance[agent.department] += efficiency;
            deptCounts[agent.department]++;
          }
        }
      }

      const avgEfficiency = totalEfficiency / (count - 1);
      const resourceUtilization = totalUtilization / (count - 1);

      for (const dept in deptPerformance) {
        if (deptCounts[dept] > 0) {
          deptPerformance[dept] /= deptCounts[dept];
        }
      }

      // Update store
      import('../../store/useStore').then(({ useStore }) => {
        useStore.getState().updateCompanyStats({
          avgEfficiency,
          resourceUtilization,
          departmentPerformance: deptPerformance
        });
      });

      this.lastStatsUpdate = now;
    }

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
        if (task.behavior === AgentBehavior.REGISTERING) {
          this.agentRegistered.set(i, true);
          // Remove from queue and shift others
          if (this.receptionQueue[0] === i) {
            this.receptionQueue.shift();
            // Update tasks for everyone else in queue
            this.receptionQueue.forEach(idx => this.assignNewTask(idx));
          }
        }
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
        const task = this.agentTasks.get(nearestNPC);
        let status = 'Wandering';
        if (task) {
          if (task.behavior === AgentBehavior.SIT) status = 'Working at desk';
          else if (task.behavior === AgentBehavior.WORKOUT) status = 'Exercising';
          else if (task.behavior === AgentBehavior.TALK) status = 'In a meeting';
          else if (task.behavior === AgentBehavior.FROZEN) status = 'Taking a break';
          else if (task.behavior === AgentBehavior.REGISTERING) status = 'Getting registered';
        }

        this.onEncounterChange({
          npcIndex: nearestNPC,
          npcDepartment: agent.department,
          npcRole: agent.role,
          npcMission: agent.mission,
          npcPersonality: agent.personality,
          npcStatus: status,
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
