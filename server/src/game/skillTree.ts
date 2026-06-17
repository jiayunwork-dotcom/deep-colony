import type {
  GameState,
  Colonist,
  SkillTreeModuleType,
  ColonistSkillTree,
  ModuleSkillTree,
  SkillNode,
  SkillEffect,
  SkillEffectType,
  ShipModule,
} from '@deep-colony/shared';
import {
  SKILL_TREE_MODULES,
  SKILL_TREE_DEFINITIONS,
  createSkillNode,
  MAX_SKILL_EFFECT_BONUS,
  SKILL_TREE_MODULE_NAMES,
} from '@deep-colony/shared';
import { addLog } from './state';

export function createInitialSkillTree(): ColonistSkillTree {
  const trees: Record<SkillTreeModuleType, ModuleSkillTree> = {} as Record<SkillTreeModuleType, ModuleSkillTree>;

  for (const module of SKILL_TREE_MODULES) {
    const nodes: Record<string, SkillNode> = {};
    const defs = SKILL_TREE_DEFINITIONS[module];
    for (const def of defs) {
      nodes[def.id] = createSkillNode(def, module);
    }
    trees[module] = {
      module,
      totalExp: 0,
      nodes,
    };
  }

  return { trees };
}

export function addExperience(
  colonist: Colonist,
  module: SkillTreeModuleType,
  amount: number
): void {
  const tree = colonist.skillTree.trees[module];
  if (!tree) return;

  tree.totalExp += amount;
}

export function canUnlockNode(
  colonist: Colonist,
  module: SkillTreeModuleType,
  nodeId: string
): boolean {
  const tree = colonist.skillTree.trees[module];
  if (!tree) return false;

  const node = tree.nodes[nodeId];
  if (!node || node.unlocked) return false;

  if (tree.totalExp < node.requiredExp) return false;

  for (const prereqId of node.prerequisites) {
    const prereqNode = tree.nodes[prereqId];
    if (!prereqNode || !prereqNode.unlocked) {
      return false;
    }
  }

  if (node.tier === 'advanced') {
    const basicNodes = Object.values(tree.nodes).filter(n => n.tier === 'basic');
    const unlockedBasic = basicNodes.filter(n => n.unlocked).length;
    if (unlockedBasic < 2) return false;
  }

  if (node.tier === 'master') {
    const advancedNodes = Object.values(tree.nodes).filter(n => n.tier === 'advanced');
    const allAdvancedUnlocked = advancedNodes.every(n => n.unlocked);
    if (!allAdvancedUnlocked) return false;
  }

  return true;
}

export function unlockSkillNode(
  state: GameState,
  colonistId: string,
  module: SkillTreeModuleType,
  nodeId: string
): { success: boolean; node?: SkillNode; error?: string } {
  const colonist = state.colonists[colonistId];
  if (!colonist) {
    return { success: false, error: '殖民者不存在' };
  }

  const tree = colonist.skillTree.trees[module];
  if (!tree) {
    return { success: false, error: '技能树模块不存在' };
  }

  const node = tree.nodes[nodeId];
  if (!node) {
    return { success: false, error: '技能节点不存在' };
  }

  if (node.unlocked) {
    return { success: false, error: '该技能节点已解锁' };
  }

  if (!canUnlockNode(colonist, module, nodeId)) {
    return { success: false, error: '不满足解锁条件' };
  }

  node.unlocked = true;

  addLog(
    state,
    `🌟 ${colonist.name} 解锁了 [${SKILL_TREE_MODULE_NAMES[module]}-${node.name}]`,
    'success'
  );

  return { success: true, node };
}

export interface SkillEffectSummary {
  efficiency: Record<string, number>;
  resistance: Record<string, number>;
  fatigueRecovery: Record<string, number>;
  expBonus: Record<string, number>;
  globalEfficiency: number;
  globalResistance: number;
  globalExpBonus: number;
}

export function calculateColonistSkillEffects(colonist: Colonist): SkillEffectSummary {
  const summary: SkillEffectSummary = {
    efficiency: {},
    resistance: {},
    fatigueRecovery: {},
    expBonus: {},
    globalEfficiency: 0,
    globalResistance: 0,
    globalExpBonus: 0,
  };

  for (const module of SKILL_TREE_MODULES) {
    const tree = colonist.skillTree.trees[module];
    if (!tree) continue;

    for (const node of Object.values(tree.nodes)) {
      if (!node.unlocked) continue;

      const effect = node.effect;
      applyEffect(summary, effect, module);
    }
  }

  return summary;
}

function applyEffect(
  summary: SkillEffectSummary,
  effect: SkillEffect,
  sourceModule: SkillTreeModuleType
): void {
  const type = effect.type;
  const value = effect.value;
  const targetModule = effect.targetModule || sourceModule;

  if (isGlobalEffect(sourceModule, effect)) {
    applyGlobalEffect(summary, type, value);
  } else {
    applyModuleEffect(summary, type, value, targetModule);
  }
}

function isGlobalEffect(module: SkillTreeModuleType, effect: SkillEffect): boolean {
  const masterNodes: Record<string, string[]> = {
    mainEngine: ['mainEngine_master_1'],
    medicalBay: ['medicalBay_master_1'],
    laboratory: ['laboratory_master_1'],
    farm: ['farm_master_1'],
    defense: ['defense_master_1'],
    communication: ['communication_master_1'],
  };

  return masterNodes[module]?.includes(`${module}_master_1`) ?? false;
}

function applyGlobalEffect(
  summary: SkillEffectSummary,
  type: SkillEffectType,
  value: number
): void {
  switch (type) {
    case 'efficiency':
      summary.globalEfficiency = Math.min(summary.globalEfficiency + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'resistance':
      summary.globalResistance = Math.min(summary.globalResistance + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'expBonus':
      summary.globalExpBonus = Math.min(summary.globalExpBonus + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'fatigueRecovery':
      for (const m of SKILL_TREE_MODULES) {
        summary.fatigueRecovery[m] = Math.min((summary.fatigueRecovery[m] || 0) + value, MAX_SKILL_EFFECT_BONUS);
      }
      break;
  }
}

function applyModuleEffect(
  summary: SkillEffectSummary,
  type: SkillEffectType,
  value: number,
  module: string
): void {
  switch (type) {
    case 'efficiency':
      summary.efficiency[module] = Math.min((summary.efficiency[module] || 0) + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'resistance':
      summary.resistance[module] = Math.min((summary.resistance[module] || 0) + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'fatigueRecovery':
      summary.fatigueRecovery[module] = Math.min((summary.fatigueRecovery[module] || 0) + value, MAX_SKILL_EFFECT_BONUS);
      break;
    case 'expBonus':
      summary.expBonus[module] = Math.min((summary.expBonus[module] || 0) + value, MAX_SKILL_EFFECT_BONUS);
      break;
  }
}

export function getModuleEfficiencyBonus(
  effects: SkillEffectSummary,
  module: SkillTreeModuleType | string
): number {
  const moduleBonus = effects.efficiency[module] || 0;
  return moduleBonus + effects.globalEfficiency;
}

export function getModuleResistanceBonus(
  effects: SkillEffectSummary,
  module: SkillTreeModuleType | string
): number {
  const moduleBonus = effects.resistance[module] || 0;
  return moduleBonus + effects.globalResistance;
}

export function getExpBonus(
  effects: SkillEffectSummary,
  module: SkillTreeModuleType | string
): number {
  const moduleBonus = effects.expBonus[module] || 0;
  return moduleBonus + effects.globalExpBonus;
}

export function getFatigueRecoveryBonus(
  effects: SkillEffectSummary,
  module: SkillTreeModuleType | string
): number {
  return effects.fatigueRecovery[module] || 0;
}

export interface SkillProcessingResult {
  colonistEffects: Record<string, SkillEffectSummary>;
  moduleEfficiencyBonuses: Record<string, number>;
}

export function processSkillEffects(state: GameState): SkillProcessingResult {
  const result: SkillProcessingResult = {
    colonistEffects: {},
    moduleEfficiencyBonuses: {},
  };

  for (const colonist of Object.values(state.colonists)) {
    if (colonist.health <= 0) continue;

    const effects = calculateColonistSkillEffects(colonist);
    result.colonistEffects[colonist.id] = effects;

    if (colonist.assignedModule) {
      const bonus = getModuleEfficiencyBonus(effects, colonist.assignedModule);
      if (bonus > 0) {
        result.moduleEfficiencyBonuses[colonist.assignedModule] =
          (result.moduleEfficiencyBonuses[colonist.assignedModule] || 0) + bonus;
      }
    }
  }

  return result;
}

export function applySkillEfficiencyToModule(
  module: ShipModule,
  skillBonus: number,
  colonists: Record<string, Colonist>
): number {
  let baseEfficiency = 1;

  if (module.durability > 0) {
    const { calculateModuleEfficiency } = require('./state');
    baseEfficiency = calculateModuleEfficiency(module, colonists);
  }

  const skillMultiplier = 1 + skillBonus / 100;
  return Math.min(baseEfficiency * skillMultiplier, 2);
}

export function getUnlockableNodes(colonist: Colonist): { module: SkillTreeModuleType; nodeId: string }[] {
  const unlockable: { module: SkillTreeModuleType; nodeId: string }[] = [];

  for (const module of SKILL_TREE_MODULES) {
    const tree = colonist.skillTree.trees[module];
    if (!tree) continue;

    for (const node of Object.values(tree.nodes)) {
      if (!node.unlocked && canUnlockNode(colonist, module, node.id)) {
        unlockable.push({ module, nodeId: node.id });
      }
    }
  }

  return unlockable;
}
