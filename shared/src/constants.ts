import type { ModuleType, SkillType } from './types';

export const MODULE_NAMES: Record<ModuleType, string> = {
  mainEngine: '主引擎',
  lifeSupport: '生命维持',
  waterCycle: '水循环',
  farm: '农场',
  quarters: '居住区',
  factory: '工厂',
  medicalBay: '医疗舱',
  laboratory: '实验室',
  defense: '防御系统',
  communication: '通信模块',
};

export const MODULE_SKILL_MATCH: Record<ModuleType, SkillType> = {
  mainEngine: 'engineering',
  lifeSupport: 'engineering',
  waterCycle: 'engineering',
  farm: 'agriculture',
  quarters: 'military',
  factory: 'engineering',
  medicalBay: 'medical',
  laboratory: 'science',
  defense: 'military',
  communication: 'science',
};

export const SKILL_NAMES: Record<SkillType, string> = {
  engineering: '工程',
  medical: '医学',
  agriculture: '农业',
  science: '科研',
  military: '军事',
};

export const SKILL_EFFICIENCY: Record<SkillType, number> = {
  engineering: 1.5,
  medical: 1.5,
  agriculture: 1.5,
  science: 1.5,
  military: 1.5,
};

export const NON_SKILL_EFFICIENCY = 0.7;

export const INITIAL_RESOURCES = {
  oxygen: 500,
  water: 500,
  food: 400,
  metal: 200,
  fuel: 800,
  electricity: 0,
  maxElectricity: 25,
  repairParts: 50,
  maxRepairParts: 300,
  waste: 0,
  maxWaste: 500,
};

export const INITIAL_COLONIST_COUNT = 200;

export const TOTAL_DISTANCE = 1000;

export const RELAY_STATIONS = [200, 400, 600, 800];

export const EVENT_PROBABILITY = 0.4;

export const WASTE_PER_PERSON = 0.3;

export const FOOD_PER_PERSON = 1;
export const WATER_PER_PERSON = 0.5;
export const OXYGEN_PER_PERSON = 0.2;

export const BIRTH_PROBABILITY = 0.05;
export const BIRTH_HEALTH_THRESHOLD = 80;
export const BIRTH_MIN_AGE = 20;
export const BIRTH_MAX_AGE = 40;

export const MUTINY_MORALE_THRESHOLD = 20;

export const DURABILITY_WARNING = 30;

export const POWER_CONSUMPTION_PER_LEVEL = 1;

export const BASE_WATER_RECOVERY = 0.5;
export const WATER_RECOVERY_PER_LEVEL = 0.15;

export const OXYGEN_PRODUCTION_PER_LEVEL = 50;

export const FOOD_PRODUCTION_PER_LEVEL = 20;

export const FUEL_CONSUMPTION_PER_LEVEL = 10;

export const DISTANCE_PER_LEVEL = 5;

export const TECH_POINTS_PER_LEVEL = 2;

export const AUTO_REPAIR_AMOUNT = 2;

export const METEOR_DAMAGE_MIN = 20;
export const METEOR_DAMAGE_MAX = 40;

export const SYSTEM_FAILURE_DAMAGE = 15;

export const DISEASE_DAMAGE_PER_TURN = 5;
export const DISEASE_BASE_DURATION = 3;

export const FOOD_SPOILAGE_RATIO = 0.3;

export const MUTINY_CREW_COUNT = 10;
export const MUTINY_DURATION = 3;
export const MUTINY_MILITARY_DURATION = 1;

export const MYSTERIOUS_SIGNAL_GOOD_CHANCE = 0.5;

export const SOLAR_STORM_DURATION = 1;

export const SLINGSHOT_BONUS_MIN = 30;
export const SLINGSHOT_BONUS_MAX = 50;
export const SLINGSHOT_METEOR_CHANCE = 0.1;

export const AFK_TURNS_BEFORE_TAKEOVER = 3;

export const PLAYER_MODULES_PER_PLAYER_MIN = 1;
export const PLAYER_MODULES_PER_PLAYER_MAX = 2;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;

export const FACTORY_METAL_PER_LEVEL = 2;
export const FACTORY_PARTS_PER_LEVEL = 3;
export const REPAIR_PARTS_PER_MODULE = 5;
export const REPAIR_AMOUNT_WITH_PARTS = 10;

export const COMMUNICATION_SCAN_RANGE = 100;
export const COMMUNICATION_RESOURCE_BONUS_CHANCE = 0.3;
export const COMMUNICATION_CALL_INTERVAL = 5;
