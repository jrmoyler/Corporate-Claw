import { WEBGL_AGENT_LIMIT, WEBGPU_AGENT_LIMIT } from './entities/populationLimits';

import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { BehaviorManager } from './behavior/BehaviorManager';
import { AGENTS, PLAYER_INDEX } from '../data/agents';
import { useStore } from '../store/useStore';
import { AgentBehavior, ChatMessage } from '../types';
import { geminiService } from '../services/geminiService';
import * as THREE from 'three/webgpu';

export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private characters: CharacterManager;

  private inputManager: InputManager | null = null;
  private behaviorManager: BehaviorManager | null = null;
  private selectedIndex: number | null = null;
  private lastAction = "";

  private frameCount = 0;
  private lastTime = 0;
  private unsubs: (() => void)[] = [];
  private isDisposed = false;

  private resizeHandler = () => this.onResize();
  private readbackPending = false;
  private chatGeneration = 0;
  public paused = false;
  private observer: ResizeObserver;
  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  public ready: Promise<void>;

  constructor(private container: HTMLElement) {
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characters = new CharacterManager(this.stage.scene);
    this.observer = new ResizeObserver(this.resizeHandler);
    this.observer.observe(container);
    this.ready = this.init();
  }

  private async init() {
    await this.engine.init();
    if (this.isDisposed) return;
    // WebGL2 can render the office, but not this agent shader's arbitrary
    // storage-buffer/bone-matrix accesses. Use standard skinning on that backend.
    const useGPU = this.engine.renderer.backend.isWebGPUBackend === true;
    useStore.getState().setAgentLimit(useGPU ? WEBGPU_AGENT_LIMIT : WEBGL_AGENT_LIMIT);
    this.characters.setInstanceCount(useStore.getState().instanceCount);
    await this.characters.load(useGPU);
    if (this.isDisposed) return;

    const state = useStore.getState();

    // Initial sync
    this.characters.setInstanceCount(state.instanceCount);
    this.characters.updateBoidsParams(state.boidsParams);
    this.characters.updateWorldSize(state.worldSize);
    this.stage.updateDimensions(state.worldSize);

    window.addEventListener('resize', this.resizeHandler);
    this.onResize();
    // Resolve the loading screen only after the first frame actually renders.
    this.stage.update();
    this.characters.update(0, this.engine.renderer);
    await this.engine.renderer.renderAsync(this.stage.scene, this.stage.camera);
    if (this.isDisposed) return;
    this.engine.renderer.setAnimationLoop(this.animate.bind(this));

    this.rebuildBehavior();

    this.inputManager = new InputManager(
      this.engine.renderer.domElement,
      this.stage.camera,
      () => this.characters.getCPUPositions(),
      () => this.characters.getCount(),
      (index) => {
        const state = useStore.getState();
        // If we are chatting, end it before changing selection
        if (state.isChatting) {
          state.endChat();
        }

        this.selectedIndex = index;
        // Update store: null = default (follow player), number = selected NPC
        useStore.getState().setSelectedNpc(index !== PLAYER_INDEX ? index : null);
      },
      (x, z) => {
        const { worldSize } = useStore.getState();
        // Constrain to grid boundaries
        if (Math.abs(x) <= worldSize && Math.abs(z) <= worldSize) {
          this.behaviorManager?.setPlayerWaypoint(x, z);
        }
      },
      (index, pos) => { useStore.getState().setHoveredNpc(index, pos); },
    );

    useStore.setState({
      startChat: async (index: number) => {
        this.chatGeneration++;
        const positions = this.characters.getCPUPositions();
        if (positions) {
          this.behaviorManager?.startChat(index, positions);

          useStore.setState({
            selectedNpcIndex: index,
            isChatting: true,
            chatMessages: [],
            isThinking: false
          });
        }
      },
      endChat: () => {
        this.chatGeneration++;
        const { selectedNpcIndex } = useStore.getState();
        this.behaviorManager?.endChat(selectedNpcIndex);
        useStore.setState({
          isChatting: false,
          isTyping: false,
          isThinking: false,
          chatMessages: []
        });
      },
      sendMessage: async (text: string) => {
        const state = useStore.getState();
        if (state.selectedNpcIndex === null || state.isThinking) return;

        const generation = this.chatGeneration;
        const agent = AGENTS[state.selectedNpcIndex];
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMessage: ChatMessage = {
          role: 'user',
          text,
          timestamp
        };

        useStore.setState((s) => ({
          chatMessages: [...s.chatMessages, userMessage],
          isThinking: true,
          isTyping: false
        }));

        try {
          const systemInstruction = `You are ${agent.role} at Corporate Claw.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional, matching your corporate persona.`;

          const responseText = await geminiService.chat(
            systemInstruction,
            useStore.getState().chatMessages.slice(0, -1), // History without the last user message
            text
          );

          if (this.isDisposed || generation !== this.chatGeneration) return;
          const modelMessage: ChatMessage = {
            role: 'model',
            text: responseText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          useStore.setState((s) => ({
            chatMessages: [...s.chatMessages, modelMessage],
            isThinking: false
          }));

          this.characters.fadeToAction('Wave');
          this.queueIdle();

        } catch (error) {
          if (this.isDisposed || generation !== this.chatGeneration) return;
          useStore.setState((s) => ({ isThinking: false, chatMessages: [...s.chatMessages, { role: 'model', text: error instanceof Error ? error.message : 'Chat unavailable.', timestamp }] }));
        }
      }
    });

    // Subscriptions
    const sub1 = useStore.subscribe((state) => {
      if (state.currentAction !== this.lastAction) {
        this.characters.fadeToAction(state.currentAction);
        this.lastAction = state.currentAction;
      }
    });

    const sub2 = useStore.subscribe((state, prevState) => {
      if (state.instanceCount !== prevState.instanceCount) {
        state.endChat();
        state.setSelectedNpc(null);
        this.characters.setInstanceCount(state.instanceCount);
        this.rebuildBehavior();
      }
      // Update Uniforms when params change
      if (state.boidsParams !== prevState.boidsParams) {
        this.characters.updateBoidsParams(state.boidsParams);
      }

      // Update World Size
      if (state.worldSize !== prevState.worldSize) {
        this.characters.updateWorldSize(state.worldSize);
        this.stage.updateDimensions(state.worldSize);
      }

      // Handle Speaking Animation trigger
      if (state.lastSpeakingTrigger !== prevState.lastSpeakingTrigger && state.lastSpeakingTrigger) {
        this.characters.setSpeaking(state.lastSpeakingTrigger.index, state.lastSpeakingTrigger.isSpeaking);
      }

      // Handle Player Thinking/Speaking during chat
      if (state.isChatting !== prevState.isChatting || state.isThinking !== prevState.isThinking || state.isTyping !== prevState.isTyping) {
        if (state.isChatting && state.selectedNpcIndex !== null) {
          // NPC speaks when thinking (model response)
          this.characters.setSpeaking(state.selectedNpcIndex, state.isThinking);

          // Player speaks when typing
          this.characters.setSpeaking(PLAYER_INDEX, state.isTyping);
        } else if (!state.isChatting && prevState.isChatting) {
          // Chat ended - clean up whichever NPC was chatting
          const prevNpcIndex = prevState.selectedNpcIndex;
          if (prevNpcIndex !== null) {
            this.characters.setSpeaking(prevNpcIndex, false);
          }
          this.characters.setSpeaking(PLAYER_INDEX, false);
        }
      }
    });

    this.unsubs.push(sub1, sub2);
  }

  private rebuildBehavior() {
    const stateBuffer = this.characters.getAgentStateBuffer();
    if (stateBuffer) {
      this.behaviorManager = new BehaviorManager(
        stateBuffer,
        AGENTS.slice(0, this.characters.getCount()),
        (encounter) => useStore.getState().setActiveEncounter(encounter),
        (index, isSpeaking) => this.characters.setSpeaking(index, isSpeaking),
        (npcIndex) => {
          // Player arrived at NPC -> Start thinking/talking
          const state = useStore.getState();
          if (state.isChatting && state.selectedNpcIndex === npcIndex) {
            this.handleNpcGreeting(npcIndex);
          }
        }
      );
    }

  }

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.engine.onResize(w, h);
    this.stage.onResize(w, h);
  }

  private animate() {
    this.engine.timer.update();
    const delta = Math.min(this.engine.timer.getDelta(), 0.05);
    if (document.hidden) return;
    if (this.paused) { this.stage.update(); this.engine.render(this.stage.scene, this.stage.camera); return; }
    const time = this.engine.timer.getElapsed();

    this.stage.update();

    // 1. GPU Update
    this.characters.update(delta, this.engine.renderer);

    // 2. GPU → CPU readback (async, 1-frame lag). Keeps debugPosArray in sync with the compute shader.
    //    Used for picking, camera follow, and the debug canvas/markers.
    const { isDebugOpen } = useStore.getState();
    if (!this.readbackPending) {
    this.readbackPending = true;
    this.characters.syncFromGPU(this.engine.renderer).then((positions) => {
      if (!positions || this.isDisposed) return;
      // Run behavior logic with fresh GPU positions
      this.behaviorManager?.update(positions);

      // Update waypoint indicator
      const playerState = this.characters.getAgentState(PLAYER_INDEX);
      if (playerState === AgentBehavior.GOTO) {
        const wp = this.characters.getAgentWaypoint(PLAYER_INDEX);
        this.stage.updateWaypoint(new THREE.Vector3(wp.x, 0, wp.z));
      } else {
        this.stage.updateWaypoint(null);
      }

      if (isDebugOpen) {
        useStore.getState().setDebugPositions(new Float32Array(positions));
        const stateBuffer = this.characters.getAgentStateBuffer();
        if (stateBuffer) {
          useStore.getState().setDebugStates(new Float32Array(stateBuffer.array));
        }
      }
    }).finally(() => { this.readbackPending = false; });
    }

    // 3. Camera follow: NPC if one is selected, otherwise always follow the player
    const { isChatting, selectedNpcIndex, setSelectedPosition, activeEvents } = useStore.getState();
    const pos = selectedNpcIndex === null ? null : this.characters.getCPUPosition(selectedNpcIndex);
    this.stage.setFollowTarget(pos);

    // Update speed multiplier based on events
    let speedMult = 1.0;
    activeEvents.forEach(e => {
      if (e.impact.speedMult) speedMult *= e.impact.speedMult;
    });
    this.characters.updateSpeedMultiplier(speedMult);

    // 4. Chat camera logic
    if (isChatting) {
      // Disable controls while moving to NPC
      const playerState = this.characters.getAgentState(PLAYER_INDEX);
      if (playerState === AgentBehavior.GOTO) {
        if (this.stage.controls) this.stage.controls.enabled = false;
      } else {
        // Re-enable controls once arrived
        if (this.stage.controls) {
          this.stage.controls.enabled = true;
        }
      }
    } else {
      // Reset camera constraints when not chatting
      if (this.stage.controls) {
        this.stage.controls.enabled = true;
      }
    }

    this.engine.render(this.stage.scene, this.stage.camera);

    this.updateStats(time);
  }

  private async handleNpcGreeting(npcIndex: number) {
    const generation = this.chatGeneration;
    const agent = AGENTS[npcIndex];
    useStore.setState({ isThinking: true });

    try {
      const systemInstruction = `You are ${agent.role} at Corporate Claw.
Department: ${agent.department}
Mission: ${agent.mission}
Personality: ${agent.personality}
Expertise: ${agent.expertise.join(', ')}

Keep your responses extremely brief (1-2 short sentences max) and professional. Introduce yourself very briefly and ask how you can help.`;

      const responseText = await geminiService.chat(
        systemInstruction,
        [],
        "Hello! Please introduce yourself briefly."
      );

      if (this.isDisposed || generation !== this.chatGeneration) return;
      const modelMessage: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      useStore.setState((s) => ({
        chatMessages: [modelMessage],
        isThinking: false
      }));

      this.characters.fadeToAction('Wave');
      this.queueIdle();
    } catch (error) {
      if (this.isDisposed || generation !== this.chatGeneration) return;
      useStore.setState({ isThinking: false, chatMessages: [{ role: 'model', text: error instanceof Error ? error.message : 'Chat unavailable.', timestamp: '' }] });
    }
  }

  private updateStats(time: number) {
    this.frameCount++;
    if (this.frameCount >= 20) {
      const fps = Math.round(20 / (time - this.lastTime));
      const info = this.engine.renderer.info;
      const count = this.characters.getCount();

      useStore.getState().updatePerformance({
        fps,
        drawCalls: info.render.drawCalls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        entities: count
      });

      this.frameCount = 0;
      this.lastTime = time;
    }
  }

  private queueIdle() {
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = setTimeout(() => { if (!this.isDisposed) this.characters.fadeToAction('Idle'); }, 2000);
  }

  public resetView() {
    this.stage.resetView();
    useStore.getState().setSelectedNpc(null);

  }

  public dispose() {
    this.isDisposed = true;
    this.chatGeneration++;
    this.observer.disconnect();
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.unsubs.forEach(unsub => unsub());
    window.removeEventListener('resize', this.resizeHandler);
    this.inputManager?.dispose();
    this.characters.dispose();
    this.stage.dispose();
    this.engine.dispose();
    
  }
}
