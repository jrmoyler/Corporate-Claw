
import { create } from 'zustand';
import { CharacterState, AnimationName, PerformanceStats, BoidsParams, ActiveEncounter } from '../types';

export const useStore = create<CharacterState>()(
  (set) => ({
    currentAction: AnimationName.WALK,
    isThinking: false,
    aiResponse: "Hello! I'm your AI character. Type something to talk to me.",
    isDebugOpen: false,
    instanceCount: 100,
    worldSize: 30,      // radius of Kaldera

    // Default Boids Parameters
    boidsParams: {
      speed: 0.025,
      separationRadius: 0.6,
      separationStrength: 0.030,
      alignmentRadius: 3.0,
      cohesionRadius: 3.0
    },

    debugPositions: null,
    debugStates: null,
    activeEncounter: null,
    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoverPosition: null,
    isChatting: false,
    isTyping: false,
    chatMessages: [],

    performance: {
      fps: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      entities: 0
    },

    lastSpeakingTrigger: null,

    companyStats: {
      totalMissions: 1240,
      successRate: 0.88,
      avgEfficiency: 0.92,
      resourceUtilization: 0.76,
      departmentPerformance: {
        'Production': 0.94,
        'Sales': 0.82,
        'Marketing': 0.86,
        'Finance': 0.91
      }
    },
    trainingState: {
      isTrainingMode: false,
      activeExercise: null,
      completedExercises: []
    },
    isDashboardOpen: false,
    activeEvents: [],
    agentProgressions: {},

    setAnimation: (name: string) => set({ currentAction: name }),
    setSpeaking: (index: number, isSpeaking: boolean) => set({
      lastSpeakingTrigger: { index, isSpeaking, timestamp: Date.now() }
    }),
    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setAIResponse: (aiResponse: string) => set({ aiResponse }),
    toggleDebug: () => set((state) => ({ isDebugOpen: !state.isDebugOpen })),
    toggleDashboard: () => set((state) => ({ isDashboardOpen: !state.isDashboardOpen })),
    setInstanceCount: (count: number) => set({ instanceCount: count }),
    setWorldSize: (size: number) => set({ worldSize: size }),

    setBoidsParams: (params) => set((state) => ({
      boidsParams: { ...state.boidsParams, ...params }
    })),

    setDebugPositions: (positions) => set({ debugPositions: positions }),
    setDebugStates: (states) => set({ debugStates: states }),
    setActiveEncounter: (encounter: ActiveEncounter | null) => set({ activeEncounter: encounter }),
    setSelectedNpc: (index: number | null) => set({ selectedNpcIndex: index, selectedPosition: null }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({ hoveredNpcIndex: index, hoverPosition: pos }),
    startChat: () => {},
    endChat: () => {},
    sendMessage: async () => {},

    updatePerformance: (performance: PerformanceStats) => set({ performance }),

    updateCompanyStats: (stats) => set((state) => ({
      companyStats: { ...state.companyStats, ...stats }
    })),
    setTrainingMode: (active) => set((state) => ({
      trainingState: { ...state.trainingState, isTrainingMode: active }
    })),
    startExercise: (exercise) => set((state) => ({
      trainingState: { ...state.trainingState, activeExercise: exercise }
    })),
    completeExercise: (id) => set((state) => ({
      trainingState: {
        ...state.trainingState,
        completedExercises: [...state.trainingState.completedExercises, id],
        activeExercise: state.trainingState.activeExercise?.id === id ? null : state.trainingState.activeExercise
      }
    })),
    addWorldEvent: (event) => set((state) => ({
      activeEvents: [...state.activeEvents, event]
    })),
    removeWorldEvent: (id) => set((state) => ({
      activeEvents: state.activeEvents.filter(e => e.id !== id)
    })),
    updateAgentXP: (index, xp) => set((state) => {
      const prog = state.agentProgressions[index] || { xp: 0, level: 1, unlockedEquipment: [] };
      const newXP = prog.xp + xp;
      const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
      return {
        agentProgressions: {
          ...state.agentProgressions,
          [index]: {
            ...prog,
            xp: newXP,
            level: newLevel
          }
        }
      };
    }),
  })
);
