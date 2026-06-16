export type ModuleType =
  | 'mainEngine'
  | 'lifeSupport'
  | 'waterCycle'
  | 'farm'
  | 'quarters'
  | 'factory'
  | 'medicalBay'
  | 'laboratory'
  | 'defense'
  | 'communication';

export type SkillType = 'engineering' | 'medical' | 'agriculture' | 'science' | 'military';

export type ResourceType = 'oxygen' | 'water' | 'food' | 'metal' | 'fuel' | 'electricity';

export type GamePhase = 'waiting' | 'playing' | 'ended';

export type TurnPhase = 'planning' | 'voting' | 'resolving' | 'events';

export interface ShipModule {
  id: ModuleType;
  name: string;
  durability: number;
  maxDurability: number;
  powerLevel: number;
  maxPowerLevel: number;
  crewRequired: number;
  crewAssigned: string[];
  efficiency: number;
}

export interface Colonist {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  morale: number;
  age: number;
  skills: Record<SkillType, number>;
  assignedModule: ModuleType | null;
  isMutineer: boolean;
  mutinyTurnsLeft: number;
  isInfected: boolean;
  infectionTurnsLeft: number;
  isFrozen: boolean;
}

export interface Resources {
  oxygen: number;
  water: number;
  food: number;
  metal: number;
  fuel: number;
  electricity: number;
  maxElectricity: number;
  repairParts: number;
  maxRepairParts: number;
  waste: number;
  maxWaste: number;
}

export interface Player {
  id: string;
  name: string;
  assignedModules: ModuleType[];
  isConnected: boolean;
  lastActionTurn: number;
  isAFK: boolean;
  afkTurns: number;
}

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  turnsRemaining: number;
  affectedModules?: ModuleType[];
  affectedColonists?: string[];
  needsVote: boolean;
  voteOptions?: string[];
  votes?: Record<string, string>;
  resolved: boolean;
}

export type EventType =
  | 'meteorStrike'
  | 'systemFailure'
  | 'diseaseOutbreak'
  | 'foodSpoilage'
  | 'mutiny'
  | 'mysteriousSignal'
  | 'solarStorm'
  | 'supplyPod';

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: number;
  prerequisites: string[];
  researched: boolean;
  effect: TechEffect;
}

export interface TechEffect {
  type:
    | 'powerBonus'
    | 'farmBonus'
    | 'autoRepair'
    | 'cryoChambers'
    | 'shieldUpgrade'
    | 'engineEfficiency'
    | 'warpDrive'
    | 'oxygenBonus'
    | 'factoryEfficiency'
    | 'waterRecoveryBonus'
    | 'medicalEfficiency'
    | 'moraleBonus'
    | 'defenseEfficiency'
    | 'metalRegeneration'
    | 'wasteRecycling';
  value: number;
}

export interface StarMap {
  totalDistance: number;
  currentDistance: number;
  relayStations: number[];
  visitedRelays: number[];
}

export interface Vote {
  eventId: string;
  options: string[];
  votes: Record<string, string>;
  expiresAtTurn: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  turn: number;
  turnPhase: TurnPhase;
  modules: Record<ModuleType, ShipModule>;
  colonists: Record<string, Colonist>;
  resources: Resources;
  players: Record<string, Player>;
  hostId: string;
  maxPlayers: number;
  events: GameEvent[];
  activeEvents: GameEvent[];
  techTree: Record<string, TechNode>;
  currentTech?: string;
  techPoints: number;
  starMap: StarMap;
  pendingVotes: Vote[];
  turnTimer?: number;
  winner?: boolean;
  finalScore?: number;
  gameLog: GameLogEntry[];
}

export interface GameLogEntry {
  turn: number;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
}

export interface PlayerAction {
  type: 'setPower' | 'assignCrew' | 'unassignCrew' | 'startResearch' | 'vote' | 'dockRelay' | 'slingshot';
  moduleId?: ModuleType;
  powerLevel?: number;
  colonistId?: string;
  techId?: string;
  voteOption?: string;
  relayDistance?: number;
}

export interface RoomInfo {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
  turn: number;
}
