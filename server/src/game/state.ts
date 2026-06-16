import { v4 as uuidv4 } from 'uuid';
import type {
  ShipModule,
  ModuleType,
  Colonist,
  SkillType,
  GameState,
  Resources,
  StarMap,
  GameLogEntry,
} from '@deep-colony/shared';
import {
  MODULE_NAMES,
  MODULE_SKILL_MATCH,
  SKILL_EFFICIENCY,
  NON_SKILL_EFFICIENCY,
  INITIAL_RESOURCES,
  INITIAL_COLONIST_COUNT,
  TOTAL_DISTANCE,
  RELAY_STATIONS,
  TECH_TREE,
  MAX_PLAYERS,
  DURABILITY_WARNING,
} from '@deep-colony/shared';

const COLONIST_FIRST_NAMES = [
  '张伟', '王芳', '李明', '刘洋', '陈静', '杨帆', '赵磊', '黄丽', '周强', '吴敏',
  '徐辉', '孙燕', '马超', '朱琳', '胡军', '郭娜', '林峰', '何雪', '高明', '罗敏',
];

const COLONIST_LAST_NAMES = [
  '张', '王', '李', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName(): string {
  const lastName = COLONIST_LAST_NAMES[randomInt(0, COLONIST_LAST_NAMES.length - 1)];
  const firstName = COLONIST_FIRST_NAMES[randomInt(0, COLONIST_FIRST_NAMES.length - 1)];
  return lastName + firstName.slice(1);
}

function randomSkills(): Record<SkillType, number> {
  const skills: Record<SkillType, number> = {
    engineering: 0,
    medical: 0,
    agriculture: 0,
    science: 0,
    military: 0,
  };
  const mainSkill = Object.keys(skills)[randomInt(0, 4)] as SkillType;
  skills[mainSkill] = randomInt(2, 5);
  const otherSkills = Object.keys(skills).filter(s => s !== mainSkill) as SkillType[];
  for (const skill of otherSkills) {
    skills[skill] = randomInt(0, 2);
  }
  return skills;
}

export function createModule(id: ModuleType, crewRequired: number): ShipModule {
  return {
    id,
    name: MODULE_NAMES[id],
    durability: 100,
    maxDurability: 100,
    powerLevel: 3,
    maxPowerLevel: 5,
    crewRequired,
    crewAssigned: [],
    efficiency: 1,
  };
}

export function createColonist(): Colonist {
  return {
    id: uuidv4(),
    name: randomName(),
    health: randomInt(70, 100),
    maxHealth: 100,
    morale: randomInt(60, 90),
    age: randomInt(20, 50),
    skills: randomSkills(),
    assignedModule: null,
    isMutineer: false,
    mutinyTurnsLeft: 0,
    isInfected: false,
    infectionTurnsLeft: 0,
    isFrozen: false,
  };
}

export function createInitialModules(): Record<ModuleType, ShipModule> {
  return {
    mainEngine: createModule('mainEngine', 8),
    lifeSupport: createModule('lifeSupport', 6),
    waterCycle: createModule('waterCycle', 5),
    farm: createModule('farm', 10),
    quarters: createModule('quarters', 4),
    factory: createModule('factory', 7),
    medicalBay: createModule('medicalBay', 5),
    laboratory: createModule('laboratory', 6),
    defense: createModule('defense', 6),
    communication: createModule('communication', 4),
  };
}

export function createInitialColonists(): Record<string, Colonist> {
  const colonists: Record<string, Colonist> = {};
  for (let i = 0; i < INITIAL_COLONIST_COUNT; i++) {
    const colonist = createColonist();
    colonists[colonist.id] = colonist;
  }
  return colonists;
}

export function createInitialResources(): Resources {
  return { ...INITIAL_RESOURCES };
}

export function createStarMap(): StarMap {
  return {
    totalDistance: TOTAL_DISTANCE,
    currentDistance: 0,
    relayStations: [...RELAY_STATIONS],
    visitedRelays: [],
  };
}

export function createInitialGameState(roomId: string): GameState {
  return {
    roomId,
    phase: 'waiting',
    turn: 0,
    turnPhase: 'planning',
    modules: createInitialModules(),
    colonists: createInitialColonists(),
    resources: createInitialResources(),
    players: {},
    hostId: '',
    maxPlayers: MAX_PLAYERS,
    events: [],
    activeEvents: [],
    techTree: JSON.parse(JSON.stringify(TECH_TREE)),
    techPoints: 0,
    starMap: createStarMap(),
    pendingVotes: [],
    gameLog: [],
  };
}

export function calculateModuleEfficiency(
  module: ShipModule,
  colonists: Record<string, Colonist>
): number {
  if (module.durability <= 0) return 0;

  let durabilityFactor = 1;
  if (module.durability < DURABILITY_WARNING) {
    durabilityFactor = module.durability / DURABILITY_WARNING;
  }

  const assignedCrew = module.crewAssigned
    .map(id => colonists[id])
    .filter(c => c && !c.isMutineer && !c.isFrozen && c.health > 0);

  if (module.crewRequired === 0) return durabilityFactor;

  let totalSkillBonus = 0;
  const matchingSkill = MODULE_SKILL_MATCH[module.id];

  for (const crew of assignedCrew) {
    const skillLevel = crew.skills[matchingSkill];
    if (skillLevel > 0) {
      totalSkillBonus += SKILL_EFFICIENCY[matchingSkill] * (0.8 + skillLevel * 0.1);
    } else {
      totalSkillBonus += NON_SKILL_EFFICIENCY;
    }
  }

  const crewFactor = Math.min(1, totalSkillBonus / module.crewRequired);

  return durabilityFactor * crewFactor;
}

export function addLog(state: GameState, message: string, type: GameLogEntry['type'] = 'info'): void {
  state.gameLog.push({
    turn: state.turn,
    message,
    type,
  });
  if (state.gameLog.length > 100) {
    state.gameLog = state.gameLog.slice(-100);
  }
}
