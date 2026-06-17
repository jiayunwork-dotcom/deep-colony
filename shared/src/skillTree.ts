import type { SkillTreeModuleType, SkillNode, SkillEffectType } from './types';

export const SKILL_TREE_MODULES: SkillTreeModuleType[] = [
  'mainEngine',
  'medicalBay',
  'laboratory',
  'farm',
  'defense',
  'communication',
];

export const SKILL_TREE_MODULE_NAMES: Record<SkillTreeModuleType, string> = {
  mainEngine: '引擎',
  medicalBay: '医疗',
  laboratory: '科研',
  farm: '农业',
  defense: '防御',
  communication: '通信',
};

export const SKILL_TREE_MODULE_COLORS: Record<SkillTreeModuleType, string> = {
  mainEngine: '#ff6b35',
  medicalBay: '#4ecdc4',
  laboratory: '#9b5de5',
  farm: '#8bc34a',
  defense: '#ef476f',
  communication: '#00b4d8',
};

export const SKILL_MODULE_MAPPING: Record<SkillTreeModuleType, string> = {
  mainEngine: '工程',
  medicalBay: '医学',
  laboratory: '科研',
  farm: '农业',
  defense: '军事',
  communication: '科学',
};

export const SKILL_NODE_TIER_NAMES: Record<string, string> = {
  basic: '基础',
  advanced: '进阶',
  master: '精通',
};

export const SKILL_EFFECT_TYPE_NAMES: Record<SkillEffectType, string> = {
  efficiency: '效率加成',
  resistance: '状态抗性',
  fatigueRecovery: '疲劳恢复',
  expBonus: '经验加成',
};

export const EXP_THRESHOLDS = {
  basic: [100, 150, 200],
  advanced: [350, 500],
  master: [800],
};

export const MAX_SKILL_EFFECT_BONUS = 50;

export const BASE_EXP_PER_TURN = 10;
export const THREESHIFT_WORKING_EXP_MULTIPLIER = 1.2;
export const FLEXIBLE_EMERGENCY_EXP_MULTIPLIER = 0.5;

export interface SkillNodeDefinition {
  id: string;
  name: string;
  description: string;
  tier: 'basic' | 'advanced' | 'master';
  requiredExp: number;
  effect: {
    type: SkillEffectType;
    value: number;
  };
  prerequisites: string[];
}

const generateSkillNodeId = (module: SkillTreeModuleType, tier: string, index: number): string => {
  return `${module}_${tier}_${index}`;
};

export const SKILL_TREE_DEFINITIONS: Record<SkillTreeModuleType, SkillNodeDefinition[]> = {
  mainEngine: [
    {
      id: generateSkillNodeId('mainEngine', 'basic', 1),
      name: '引擎基础1',
      description: '维修速度+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('mainEngine', 'basic', 2),
      name: '引擎基础2',
      description: '燃料消耗降低5%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'efficiency', value: 5 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('mainEngine', 'basic', 3),
      name: '引擎基础3',
      description: '航行速度+8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('mainEngine', 'advanced', 1),
      name: '引擎进阶1',
      description: '维修速度+20%，疲劳恢复+10%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'efficiency', value: 20 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('mainEngine', 'advanced', 2),
      name: '引擎进阶2',
      description: '引擎效率+25%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 25 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('mainEngine', 'master', 1),
      name: '引擎精通',
      description: '全模块效率+15%，引擎经验获取+20%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'efficiency', value: 15 },
      prerequisites: [],
    },
  ],
  medicalBay: [
    {
      id: generateSkillNodeId('medicalBay', 'basic', 1),
      name: '医疗基础1',
      description: '治疗速度+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('medicalBay', 'basic', 2),
      name: '医疗基础2',
      description: '感染治愈概率+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'resistance', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('medicalBay', 'basic', 3),
      name: '医疗基础3',
      description: '健康恢复速度+8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('medicalBay', 'advanced', 1),
      name: '医疗进阶1',
      description: '感染治愈概率+15%，感染伤害降低20%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'resistance', value: 15 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('medicalBay', 'advanced', 2),
      name: '医疗进阶2',
      description: '治疗效率+25%，全员健康上限+5',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 25 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('medicalBay', 'master', 1),
      name: '医疗精通',
      description: '全员状态抗性+20%，医疗经验获取+20%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'resistance', value: 20 },
      prerequisites: [],
    },
  ],
  laboratory: [
    {
      id: generateSkillNodeId('laboratory', 'basic', 1),
      name: '科研基础1',
      description: '科研点数产出+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('laboratory', 'basic', 2),
      name: '科研基础2',
      description: '研究速度+8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('laboratory', 'basic', 3),
      name: '科研基础3',
      description: '科技点消耗降低5%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 5 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('laboratory', 'advanced', 1),
      name: '科研进阶1',
      description: '研究效率+20%，科研经验获取+10%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'efficiency', value: 20 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('laboratory', 'advanced', 2),
      name: '科研进阶2',
      description: '科技点产出+25%，解锁特殊研究分支',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 25 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('laboratory', 'master', 1),
      name: '科研精通',
      description: '全员效率+10%，科研经验获取+25%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'expBonus', value: 25 },
      prerequisites: [],
    },
  ],
  farm: [
    {
      id: generateSkillNodeId('farm', 'basic', 1),
      name: '农业基础1',
      description: '食物产量+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('farm', 'basic', 2),
      name: '农业基础2',
      description: '食物质量提升，士气+5',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'efficiency', value: 5 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('farm', 'basic', 3),
      name: '农业基础3',
      description: '水消耗降低8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('farm', 'advanced', 1),
      name: '农业进阶1',
      description: '食物产量+20%，农场效率+15%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'efficiency', value: 20 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('farm', 'advanced', 2),
      name: '农业进阶2',
      description: '食物保存时间延长，浪费减少25%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 25 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('farm', 'master', 1),
      name: '农业精通',
      description: '全员健康+10，农业经验获取+20%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'efficiency', value: 15 },
      prerequisites: [],
    },
  ],
  defense: [
    {
      id: generateSkillNodeId('defense', 'basic', 1),
      name: '防御基础1',
      description: '防御力+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('defense', 'basic', 2),
      name: '防御基础2',
      description: '叛变概率降低10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'resistance', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('defense', 'basic', 3),
      name: '防御基础3',
      description: '武器精度+8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('defense', 'advanced', 1),
      name: '防御进阶1',
      description: '防御力+20%，叛变概率降低15%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'resistance', value: 15 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('defense', 'advanced', 2),
      name: '防御进阶2',
      description: '护盾效率+25%，陨石伤害降低20%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 25 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('defense', 'master', 1),
      name: '防御精通',
      description: '全员状态抗性+15%，防御经验获取+20%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'resistance', value: 15 },
      prerequisites: [],
    },
  ],
  communication: [
    {
      id: generateSkillNodeId('communication', 'basic', 1),
      name: '通信基础1',
      description: '信号强度+10%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[0],
      effect: { type: 'efficiency', value: 10 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('communication', 'basic', 2),
      name: '通信基础2',
      description: '扫描范围+15%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[1],
      effect: { type: 'efficiency', value: 15 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('communication', 'basic', 3),
      name: '通信基础3',
      description: '资源补给概率+8%',
      tier: 'basic',
      requiredExp: EXP_THRESHOLDS.basic[2],
      effect: { type: 'efficiency', value: 8 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('communication', 'advanced', 1),
      name: '通信进阶1',
      description: '信号解析效率+20%，神秘信号奖励提升',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[0],
      effect: { type: 'efficiency', value: 20 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('communication', 'advanced', 2),
      name: '通信进阶2',
      description: '远程呼叫间隔减少2回合，补给概率+15%',
      tier: 'advanced',
      requiredExp: EXP_THRESHOLDS.advanced[1],
      effect: { type: 'efficiency', value: 15 },
      prerequisites: [],
    },
    {
      id: generateSkillNodeId('communication', 'master', 1),
      name: '通信精通',
      description: '全员经验获取+10%，通信经验获取+25%',
      tier: 'master',
      requiredExp: EXP_THRESHOLDS.master[0],
      effect: { type: 'expBonus', value: 25 },
      prerequisites: [],
    },
  ],
};

export function createSkillNode(def: SkillNodeDefinition, module: SkillTreeModuleType): SkillNode {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    tier: def.tier,
    module,
    requiredExp: def.requiredExp,
    unlocked: false,
    prerequisites: def.prerequisites,
    effect: {
      ...def.effect,
      targetModule: module,
    },
  };
}
