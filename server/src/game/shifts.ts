import type {
  GameState,
  ShipModule,
  Colonist,
  ModuleType,
  ShiftMode,
  ShiftGroup,
  ShiftAssignment,
  TurnShiftUpdate,
  ColonistStatusUpdate,
  ShiftProcessingResult,
  SkillTreeModuleType,
} from '@deep-colony/shared';
import {
  MODULE_SKILL_MATCH,
  FATIGUE_OVERWORK_THRESHOLD,
  FATIGUE_COLLAPSE_THRESHOLD,
  CONTINUOUS_FATIGUE_PER_TURN,
  THREESHIFT_WORKING_FATIGUE_PER_TURN,
  THREESHIFT_RESTING_RECOVERY_PER_TURN,
  FLEXIBLE_EMERGENCY_FATIGUE_PER_TURN,
  FLEXIBLE_NORMAL_FATIGUE_PER_TURN,
  FLEXIBLE_NORMAL_STAFF_RATIO,
  THREESHIFT_TURNS_PER_SHIFT,
  UNDERSTAFFED_ALARM_RATIO,
  EMERGENCY_DURABILITY_THRESHOLD,
  BASE_EXP_PER_TURN,
  THREESHIFT_WORKING_EXP_MULTIPLIER,
  FLEXIBLE_EMERGENCY_EXP_MULTIPLIER,
  SKILL_TREE_MODULES,
} from '@deep-colony/shared';
import { addLog } from './state';
import type { SkillProcessingResult } from './skillTree';
import { addExperience, getExpBonus, getFatigueRecoveryBonus } from './skillTree';

const SHIFT_CYCLE: ShiftGroup[] = ['A', 'B', 'B', 'C', 'C', 'A'];

export function processAllShifts(state: GameState, skillResult?: SkillProcessingResult): ShiftProcessingResult {
  const result: ShiftProcessingResult = {
    shiftUpdates: [],
    statusUpdates: [],
  };

  for (const module of Object.values(state.modules)) {
    const moduleResult = processModuleShifts(state, module, skillResult);
    result.shiftUpdates.push(...moduleResult.shiftUpdates);
    result.statusUpdates.push(...moduleResult.statusUpdates);
  }

  return result;
}

function calculateExpGain(
  colonist: Colonist,
  module: ShipModule,
  isWorking: boolean,
  skillResult?: SkillProcessingResult
): number {
  if (!isWorking) return 0;

  const skillModule = module.id as SkillTreeModuleType;
  if (!SKILL_TREE_MODULES.includes(skillModule)) return 0;

  const { calculateModuleEfficiency } = require('./state');
  const efficiency = calculateModuleEfficiency(module, { [colonist.id]: colonist });

  let exp = BASE_EXP_PER_TURN * efficiency;

  const shiftMode = module.shiftConfig.mode;
  if (shiftMode === 'threeShift') {
    const currentShift = module.shiftConfig.currentShift;
    const assignment = module.shiftConfig.assignments.find(a => a.colonistId === colonist.id);
    if (assignment?.group === currentShift) {
      exp *= THREESHIFT_WORKING_EXP_MULTIPLIER;
    }
  } else if (shiftMode === 'flexible' && module.shiftConfig.emergencyLevel === 'critical') {
    exp *= FLEXIBLE_EMERGENCY_EXP_MULTIPLIER;
  }

  if (skillResult) {
    const effects = skillResult.colonistEffects[colonist.id];
    if (effects) {
      const expBonus = getExpBonus(effects, skillModule);
      exp *= (1 + expBonus / 100);
    }
  }

  return Math.round(exp);
}

function processModuleShifts(
  state: GameState,
  module: ShipModule,
  skillResult?: SkillProcessingResult
): ShiftProcessingResult {
  const result: ShiftProcessingResult = {
    shiftUpdates: [],
    statusUpdates: [],
  };

  const assignedColonists = module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !c.isFrozen && c.health > 0);

  const collapsedColonists = assignedColonists.filter(c => c.isCollapsed);
  for (const c of collapsedColonists) {
    handleCollapsedColonist(state, module, c, result);
  }

  const shiftMode = module.shiftConfig.mode;

  switch (shiftMode) {
    case 'continuous':
      processContinuousMode(state, module, result, skillResult);
      break;
    case 'threeShift':
      processThreeShiftMode(state, module, result, skillResult);
      break;
    case 'flexible':
      processFlexibleMode(state, module, result, skillResult);
      break;
  }

  checkModuleAlarm(state, module, result);

  return result;
}

function handleCollapsedColonist(
  state: GameState,
  module: ShipModule,
  colonist: Colonist,
  result: ShiftProcessingResult
): void {
  module.crewAssigned = module.crewAssigned.filter(id => id !== colonist.id);
  module.shiftConfig.assignments = module.shiftConfig.assignments.filter(
    a => a.colonistId !== colonist.id
  );

  const medicalBay = state.modules.medicalBay;
  if (medicalBay) {
    colonist.assignedModule = 'medicalBay';
    medicalBay.crewAssigned.push(colonist.id);
    medicalBay.shiftConfig.assignments.push({
      colonistId: colonist.id,
      group: 'A',
    });
  } else {
    colonist.assignedModule = null;
  }

  addLog(state, `🚑 ${colonist.name} 因过度疲劳被送往医疗舱`, 'danger');

  result.statusUpdates.push({
    colonistId: colonist.id,
    isOverworked: colonist.isOverworked,
    isCollapsed: colonist.isCollapsed,
    fatigue: colonist.fatigue,
  });
}

function processContinuousMode(
  state: GameState,
  module: ShipModule,
  result: ShiftProcessingResult,
  skillResult?: SkillProcessingResult
): void {
  const workingColonists = getActiveCrew(module, state);

  for (const colonist of workingColonists) {
    updateColonistFatigue(colonist, CONTINUOUS_FATIGUE_PER_TURN, state, result, skillResult);

    const expGain = calculateExpGain(colonist, module, true, skillResult);
    if (expGain > 0 && SKILL_TREE_MODULES.includes(module.id as SkillTreeModuleType)) {
      addExperience(colonist, module.id as SkillTreeModuleType, expGain);
    }
  }
}

function processThreeShiftMode(
  state: GameState,
  module: ShipModule,
  result: ShiftProcessingResult,
  skillResult?: SkillProcessingResult
): void {
  module.shiftConfig.turnsUntilNextShift--;

  if (module.shiftConfig.turnsUntilNextShift <= 0) {
    rotateThreeShift(module, state, result);
    module.shiftConfig.turnsUntilNextShift = THREESHIFT_TURNS_PER_SHIFT;
  }

  const currentShift = module.shiftConfig.currentShift;
  const allAssigned = module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !c.isFrozen && !c.isCollapsed && c.health > 0);

  for (const colonist of allAssigned) {
    const assignment = module.shiftConfig.assignments.find(
      a => a.colonistId === colonist.id
    );
    const isWorking = assignment?.group === currentShift;

    if (isWorking) {
      updateColonistFatigue(colonist, THREESHIFT_WORKING_FATIGUE_PER_TURN, state, result, skillResult);

      const expGain = calculateExpGain(colonist, module, true, skillResult);
      if (expGain > 0 && SKILL_TREE_MODULES.includes(module.id as SkillTreeModuleType)) {
        addExperience(colonist, module.id as SkillTreeModuleType, expGain);
      }
    } else {
      updateColonistFatigue(colonist, -THREESHIFT_RESTING_RECOVERY_PER_TURN, state, result, skillResult);
    }
  }

  result.shiftUpdates.push({
    moduleId: module.id,
    shiftConfig: { ...module.shiftConfig },
    affectedColonists: allAssigned.map(c => c.id),
  });
}

function rotateThreeShift(
  module: ShipModule,
  state: GameState,
  result: ShiftProcessingResult
): void {
  const currentIdx = SHIFT_CYCLE.indexOf(module.shiftConfig.currentShift);
  const nextIdx = (currentIdx + 1) % SHIFT_CYCLE.length;
  const nextShift = SHIFT_CYCLE[nextIdx];
  const prevShift = module.shiftConfig.currentShift;

  module.shiftConfig.currentShift = nextShift;

  addLog(
    state,
    `🔄 ${module.name} 班次轮换：${prevShift}班 → ${nextShift}班`,
    'info'
  );
}

function processFlexibleMode(
  state: GameState,
  module: ShipModule,
  result: ShiftProcessingResult,
  skillResult?: SkillProcessingResult
): void {
  const isEmergency = module.durability < EMERGENCY_DURABILITY_THRESHOLD;
  module.shiftConfig.emergencyLevel = isEmergency ? 'critical' : 'normal';

  const allAssigned = module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !c.isFrozen && !c.isCollapsed && c.health > 0);

  if (isEmergency) {
    for (const colonist of allAssigned) {
      updateColonistFatigue(colonist, FLEXIBLE_EMERGENCY_FATIGUE_PER_TURN, state, result, skillResult);

      const expGain = calculateExpGain(colonist, module, true, skillResult);
      if (expGain > 0 && SKILL_TREE_MODULES.includes(module.id as SkillTreeModuleType)) {
        addExperience(colonist, module.id as SkillTreeModuleType, expGain);
      }
    }
    addLog(state, `⚠️ ${module.name} 进入紧急状态，全员上岗`, 'warning');
  } else {
    const requiredStaff = Math.ceil(module.crewRequired * FLEXIBLE_NORMAL_STAFF_RATIO);
    const sortedByFatigue = [...allAssigned].sort((a, b) => a.fatigue - b.fatigue);
    const working = sortedByFatigue.slice(0, requiredStaff);
    const resting = sortedByFatigue.slice(requiredStaff);

    for (const colonist of working) {
      updateColonistFatigue(colonist, FLEXIBLE_NORMAL_FATIGUE_PER_TURN, state, result, skillResult);

      const expGain = calculateExpGain(colonist, module, true, skillResult);
      if (expGain > 0 && SKILL_TREE_MODULES.includes(module.id as SkillTreeModuleType)) {
        addExperience(colonist, module.id as SkillTreeModuleType, expGain);
      }
    }
    for (const colonist of resting) {
      updateColonistFatigue(colonist, -THREESHIFT_RESTING_RECOVERY_PER_TURN, state, result, skillResult);
    }
  }

  result.shiftUpdates.push({
    moduleId: module.id,
    shiftConfig: { ...module.shiftConfig },
    affectedColonists: allAssigned.map(c => c.id),
  });
}

function updateColonistFatigue(
  colonist: Colonist,
  delta: number,
  state: GameState,
  result: ShiftProcessingResult,
  skillResult?: SkillProcessingResult
): void {
  let adjustedDelta = delta;

  if (delta < 0 && skillResult) {
    const effects = skillResult.colonistEffects[colonist.id];
    if (effects && colonist.assignedModule) {
      const recoveryBonus = getFatigueRecoveryBonus(effects, colonist.assignedModule);
      adjustedDelta = delta * (1 + recoveryBonus / 100);
    }
  }

  const oldFatigue = colonist.fatigue;
  colonist.fatigue = Math.max(0, Math.min(100, colonist.fatigue + adjustedDelta));

  let statusChanged = false;

  if (colonist.fatigue >= FATIGUE_COLLAPSE_THRESHOLD && !colonist.isCollapsed) {
    colonist.isCollapsed = true;
    colonist.isOverworked = true;
    statusChanged = true;
    addLog(state, `💀 ${colonist.name} 疲劳过度倒下了！`, 'danger');
  } else if (colonist.fatigue >= FATIGUE_OVERWORK_THRESHOLD && !colonist.isOverworked) {
    colonist.isOverworked = true;
    statusChanged = true;
    addLog(state, `😰 ${colonist.name} 进入过劳状态，效率下降`, 'warning');
  } else if (colonist.fatigue < FATIGUE_OVERWORK_THRESHOLD && colonist.isOverworked && !colonist.isCollapsed) {
    colonist.isOverworked = false;
    statusChanged = true;
    addLog(state, `✅ ${colonist.name} 从过劳状态恢复`, 'success');
  }

  if (statusChanged || oldFatigue !== colonist.fatigue) {
    result.statusUpdates.push({
      colonistId: colonist.id,
      isOverworked: colonist.isOverworked,
      isCollapsed: colonist.isCollapsed,
      fatigue: colonist.fatigue,
    });
  }
}

function checkModuleAlarm(
  state: GameState,
  module: ShipModule,
  result: ShiftProcessingResult
): void {
  const activeCrew = getActiveCrew(module, state);
  const required = module.crewRequired;
  const ratio = required > 0 ? activeCrew.length / required : 1;

  const wasInAlarm = module.shiftConfig.hasAlarm;
  const isNowInAlarm = ratio < UNDERSTAFFED_ALARM_RATIO;

  if (isNowInAlarm && !wasInAlarm) {
    module.shiftConfig.hasAlarm = true;
    addLog(state, `🚨 ${module.name} 在岗人数不足 ${Math.round(UNDERSTAFFED_ALARM_RATIO * 100)}%！`, 'danger');
  } else if (!isNowInAlarm && wasInAlarm) {
    module.shiftConfig.hasAlarm = false;
    addLog(state, `✅ ${module.name} 人员配置恢复正常`, 'success');
  }

  if (wasInAlarm !== isNowInAlarm) {
    result.shiftUpdates.push({
      moduleId: module.id,
      shiftConfig: { ...module.shiftConfig },
      affectedColonists: [],
    });
  }
}

function getActiveCrew(module: ShipModule, state: GameState): Colonist[] {
  const mode = module.shiftConfig.mode;
  const allAssigned = module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !c.isFrozen && !c.isCollapsed && c.health > 0);

  if (mode === 'threeShift') {
    const currentShift = module.shiftConfig.currentShift;
    return allAssigned.filter(c => {
      const assignment = module.shiftConfig.assignments.find(
        a => a.colonistId === c.id
      );
      return assignment?.group === currentShift;
    });
  }

  if (mode === 'flexible') {
    const isEmergency = module.shiftConfig.emergencyLevel === 'critical';
    if (isEmergency) {
      return allAssigned;
    }
    const requiredStaff = Math.ceil(module.crewRequired * FLEXIBLE_NORMAL_STAFF_RATIO);
    return [...allAssigned].sort((a, b) => a.fatigue - b.fatigue).slice(0, requiredStaff);
  }

  return allAssigned;
}

export function changeModuleShiftMode(
  state: GameState,
  moduleId: ModuleType,
  mode: ShiftMode
): boolean {
  const module = state.modules[moduleId];
  if (!module) return false;

  const oldMode = module.shiftConfig.mode;
  module.shiftConfig.mode = mode;

  if (mode === 'threeShift' && oldMode !== 'threeShift') {
    autoAssignShiftGroups(module, state);
  }

  if (mode === 'flexible') {
    const isEmergency = module.durability < EMERGENCY_DURABILITY_THRESHOLD;
    module.shiftConfig.emergencyLevel = isEmergency ? 'critical' : 'normal';
  } else {
    module.shiftConfig.emergencyLevel = 'normal';
  }

  addLog(state, `⚙️ ${module.name} 轮班模式变更为 ${getModeName(mode)}`, 'info');

  return true;
}

export function reassignColonistShiftGroup(
  state: GameState,
  moduleId: ModuleType,
  colonistId: string,
  group: ShiftGroup
): boolean {
  const module = state.modules[moduleId];
  if (!module) return false;
  if (module.shiftConfig.mode !== 'threeShift') return false;

  const colonist = state.colonists[colonistId];
  if (!colonist || colonist.assignedModule !== moduleId) return false;

  const existingIdx = module.shiftConfig.assignments.findIndex(
    a => a.colonistId === colonistId
  );

  if (existingIdx >= 0) {
    module.shiftConfig.assignments[existingIdx].group = group;
  } else {
    module.shiftConfig.assignments.push({ colonistId, group });
  }

  return true;
}

function autoAssignShiftGroups(module: ShipModule, state: GameState): void {
  const matchingSkill = MODULE_SKILL_MATCH[module.id];
  const colonists = module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !c.isFrozen && !c.isCollapsed && c.health > 0)
    .sort((a, b) => {
      const skillA = a.skills[matchingSkill];
      const skillB = b.skills[matchingSkill];
      return skillB - skillA;
    });

  module.shiftConfig.assignments = [];
  const groups: ShiftGroup[] = ['A', 'B', 'C'];

  colonists.forEach((c, idx) => {
    module.shiftConfig.assignments.push({
      colonistId: c.id,
      group: groups[idx % 3],
    });
  });
}

function getModeName(mode: ShiftMode): string {
  const names: Record<ShiftMode, string> = {
    continuous: '连续工作',
    threeShift: '三班倒',
    flexible: '弹性排班',
  };
  return names[mode];
}

export function getColonistShiftGroup(
  module: ShipModule,
  colonistId: string
): ShiftGroup | null {
  const assignment = module.shiftConfig.assignments.find(
    a => a.colonistId === colonistId
  );
  return assignment?.group || null;
}

export function getModuleWorkingCrew(
  module: ShipModule,
  state: GameState
): Colonist[] {
  return getActiveCrew(module, state);
}

export function getModuleRestingCrew(
  module: ShipModule,
  state: GameState
): Colonist[] {
  const activeIds = new Set(getActiveCrew(module, state).map(c => c.id));
  return module.crewAssigned
    .map(id => state.colonists[id])
    .filter(c => c && !activeIds.has(c.id) && !c.isFrozen && !c.isCollapsed && c.health > 0);
}
