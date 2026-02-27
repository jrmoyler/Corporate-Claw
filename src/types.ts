
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  entities: number;
}

export interface BoidsParams {
  speed: number;
  separationRadius: number;
  separationStrength: number;
  alignmentRadius: number;
  cohesionRadius: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface AgentNeeds {
  energy: number;
  focus: number;
  social: number;
}

export interface CompanyStats {
  totalMissions: number;
  successRate: number;
  avgEfficiency: number;
  resourceUtilization: number;
  departmentPerformance: Record<string, number>;
}

export interface TrainingExercise {
  id: string;
  name: string;
  description: string;
  difficulty: 'Junior' | 'Senior' | 'Executive';
  completed: boolean;
}

export interface TrainingState {
  isTrainingMode: boolean;
  activeExercise: TrainingExercise | null;
  completedExercises: string[];
}

export interface AgentProgression {
  xp: number;
  level: number;
  unlockedEquipment: string[];
}

export interface WorldEvent {
  id: string;
  name: string;
  description: string;
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  duration: number; // in seconds
  startTime: number;
  impact: {
    energyDecayMult?: number;
    focusDecayMult?: number;
    socialDecayMult?: number;
    speedMult?: number;
    successRateMult?: number;
  };
}

export interface CharacterState {
  currentAction: string;
  isThinking: boolean;
  aiResponse: string;
  isDebugOpen: boolean;
  instanceCount: number;
  worldSize: number;
  boidsParams: BoidsParams;
  debugPositions: Float32Array | null;
  debugStates: Float32Array | null;    // vec4 stride: .w = AgentBehavior per instance
  activeEncounter: ActiveEncounter | null;
  selectedNpcIndex: number | null;    // NPC explicitly clicked in the scene
  selectedPosition: { x: number; y: number } | null; // Screen coordinates for selected bubble
  hoveredNpcIndex: number | null;     // NPC currently under the cursor
  hoverPosition: { x: number; y: number } | null; // Screen coordinates for hover bubble
  isChatting: boolean;
  isTyping: boolean; // Player is typing in textarea
  chatMessages: ChatMessage[];

  performance: PerformanceStats;
  lastSpeakingTrigger: { index: number, isSpeaking: boolean, timestamp: number } | null;

  // New State
  companyStats: CompanyStats;
  trainingState: TrainingState;
  isDashboardOpen: boolean;
  activeEvents: WorldEvent[];
  agentProgressions: Record<number, AgentProgression>;

  setAnimation: (name: string) => void;
  setSpeaking: (index: number, isSpeaking: boolean) => void;
  setThinking: (isThinking: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  setAIResponse: (response: string) => void;
  toggleDebug: () => void;
  toggleDashboard: () => void;
  setInstanceCount: (count: number) => void;
  setWorldSize: (size: number) => void;
  setBoidsParams: (params: Partial<BoidsParams>) => void;
  setDebugPositions: (positions: Float32Array) => void;
  setDebugStates: (states: Float32Array) => void;
  setActiveEncounter: (encounter: ActiveEncounter | null) => void;
  setSelectedNpc: (index: number | null) => void;
  setSelectedPosition: (pos: { x: number; y: number } | null) => void;
  setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => void;
  startChat: (index: number) => void;
  endChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  updatePerformance: (stats: PerformanceStats) => void;
  
  // New Actions
  updateCompanyStats: (stats: Partial<CompanyStats>) => void;
  setTrainingMode: (active: boolean) => void;
  startExercise: (exercise: TrainingExercise) => void;
  completeExercise: (id: string) => void;
  addWorldEvent: (event: WorldEvent) => void;
  removeWorldEvent: (id: string) => void;
  updateAgentXP: (index: number, xp: number) => void;
}

export enum AnimationName {
  IDLE = 'Idle',
  WALK = 'Walk'
}

/** Stored as a float in the GPU agent buffer (.w component). */
export enum AgentBehavior {
  BOIDS = 0,   // follows Reynolds separation
  FROZEN = 1,  // position locked, velocity zero
  GOTO = 2,    // moves toward waypoint (.x/.z of agent buffer)
  TALK = 3,    // position locked, playing talk animation
  SIT = 4,     // sitting at a desk
  WORKOUT = 5, // exercising in the gym
  REGISTERING = 6, // at the front desk
}

export interface ActiveEncounter {
  npcIndex: number;
  npcDepartment: string;
  npcRole: string;
  npcMission: string;
  npcPersonality: string;
  npcStatus: string;
}

export type ExpressionKey = 'idle' | 'listening' | 'neutral' | 'surprised' | 'happy' | 'sick' | 'wink' | 'doubtful' | 'sad';

export interface AtlasCoords {
  col: number;
  row: number;
}

export interface ExpressionConfig {
  eyes: AtlasCoords;
  mouth: AtlasCoords;
}
