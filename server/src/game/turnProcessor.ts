import type { GameState, PlayerAction, ModuleType, BatchPlayerAction, BatchActionResult, ShiftMode, ShiftGroup, ShiftProcessingResult } from '@deep-colony/shared';
import { addLog, calculateModuleEfficiency, isModuleInEmergency, getEmergencyModules } from './state';
import {
  processResourceProduction,
  processColonistStatus,
  processPopulationGrowth,
  processAutoRepair,
  checkPowerBalance,
  forcePowerReduction,
} from './resources';
import { triggerRandomEvent, processActiveEvents } from './events';
import { processTravel, checkVictory, checkDefeat } from './travel';
import { processResearch } from './tech';
import { processAllShifts, changeModuleShiftMode, reassignColonistShiftGroup } from './shifts';
import { MODULE_SKILL_MATCH, AFK_TURNS_BEFORE_TAKEOVER, DISASTER_CHAIN_MODULE_THRESHOLD } from '@deep-colony/shared';

const MAX_HISTORY_POINTS = 20;

export function recordColonistStats(state: GameState): void {
  for (const colonist of Object.values(state.colonists)) {
    colonist.statsHistory.push({
      turn: state.turn,
      health: colonist.health,
      morale: colonist.morale,
      fatigue: colonist.fatigue,
    });
    if (colonist.statsHistory.length > MAX_HISTORY_POINTS) {
      colonist.statsHistory = colonist.statsHistory.slice(-MAX_HISTORY_POINTS);
    }
  }
}

export function processTurn(state: GameState): ShiftProcessingResult {
  if (state.phase !== 'playing') return { shiftUpdates: [], statusUpdates: [] };

  state.turn++;
  recordColonistStats(state);
  addLog(state, `=== 第 ${state.turn} 回合开始 ===`, 'info');

  const shiftResult = processAllShifts(state);

  if (!checkPowerBalance(state)) {
    addLog(state, '⚠️ 总功耗超过发电上限，系统强制降低部分模块功耗', 'warning');
    forcePowerReduction(state);
  }

  const hasSolarStorm = state.activeEvents.some(e => e.type === 'solarStorm' && e.turnsRemaining > 0);
  if (hasSolarStorm) {
    addLog(state, '☀️ 太阳风暴肆虐，本回合系统无法正常运作', 'warning');
  } else {
    processResourceProduction(state);
    processColonistStatus(state);
    processPopulationGrowth(state);
    processAutoRepair(state);
    processTravel(state);
    processResearch(state);
  }

  processActiveEvents(state);

  const emergencyModules = getEmergencyModules(state);
  const isDisasterChain = emergencyModules.length > DISASTER_CHAIN_MODULE_THRESHOLD;

  if (isDisasterChain) {
    addLog(state, '⚠️ 灾难连锁：多模块濒临瘫痪，危机加剧', 'danger');
  }

  triggerRandomEvent(state, isDisasterChain);

  if (checkVictory(state)) return shiftResult;
  if (checkDefeat(state)) return shiftResult;

  updateModuleEfficiencies(state);

  checkAfkPlayers(state);

  addLog(state, `=== 第 ${state.turn} 回合结束 ===`, 'info');

  return shiftResult;
}

export function updateModuleEfficiencies(state: GameState): void {
  for (const module of Object.values(state.modules)) {
    module.efficiency = calculateModuleEfficiency(module, state.colonists);
  }
}

export function canPlayerModifyModule(
  state: GameState,
  playerId: string,
  moduleId: ModuleType
): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  if (player.isAFK) return false;
  if (state.hostId === playerId) return true;
  return player.assignedModules.includes(moduleId);
}

export function applyPlayerAction(state: GameState, playerId: string, action: PlayerAction): boolean {
  switch (action.type) {
    case 'setPower':
      return handleSetPower(state, playerId, action);
    case 'assignCrew':
      return handleAssignCrew(state, playerId, action);
    case 'unassignCrew':
      return handleUnassignCrew(state, playerId, action);
    case 'startResearch':
      return handleStartResearch(state, playerId, action);
    case 'vote':
      return handleVote(state, playerId, action);
    case 'changeShiftMode':
      return handleChangeShiftMode(state, playerId, action);
    case 'reassignShiftGroup':
      return handleReassignShiftGroup(state, playerId, action);
    default:
      return false;
  }
}

function handleSetPower(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.moduleId || action.powerLevel === undefined) return false;
  if (!canPlayerModifyModule(state, playerId, action.moduleId)) return false;

  const module = state.modules[action.moduleId];
  if (!module) return false;

  if (action.powerLevel < 1 || action.powerLevel > module.maxPowerLevel) return false;

  if (isModuleInEmergency(module) && action.powerLevel > module.powerLevel) {
    addLog(state, `⚠️ ${module.name} 处于紧急状态，无法调高功耗`, 'warning');
    return false;
  }

  module.powerLevel = action.powerLevel;
  state.players[playerId].lastActionTurn = state.turn;
  addLog(state, `${state.players[playerId].name} 将 ${module.name} 功耗调整为 ${action.powerLevel} 级`, 'info');
  return true;
}

function handleAssignCrew(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.moduleId || !action.colonistId) return false;
  if (!canPlayerModifyModule(state, playerId, action.moduleId)) return false;

  const module = state.modules[action.moduleId];
  const colonist = state.colonists[action.colonistId];
  if (!module || !colonist) return false;
  if (colonist.health <= 0 || colonist.isMutineer || colonist.isFrozen) return false;

  if (colonist.assignedModule) {
    const oldModule = state.modules[colonist.assignedModule as ModuleType];
    if (oldModule) {
      oldModule.crewAssigned = oldModule.crewAssigned.filter(id => id !== colonist.id);
    }
  }

  colonist.assignedModule = action.moduleId;
  module.crewAssigned.push(colonist.id);

  state.players[playerId].lastActionTurn = state.turn;
  return true;
}

function handleUnassignCrew(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.colonistId) return false;

  const colonist = state.colonists[action.colonistId];
  if (!colonist || !colonist.assignedModule) return false;

  const moduleId = colonist.assignedModule as ModuleType;
  if (!canPlayerModifyModule(state, playerId, moduleId)) return false;

  const module = state.modules[moduleId];
  if (!module) return false;

  module.crewAssigned = module.crewAssigned.filter(id => id !== colonist.id);
  colonist.assignedModule = null;

  state.players[playerId].lastActionTurn = state.turn;
  return true;
}

function handleStartResearch(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.techId) return false;

  const player = state.players[playerId];
  if (!player || !player.assignedModules.includes('laboratory')) return false;

  const { startResearch } = require('./tech');
  const result = startResearch(state, action.techId);
  if (result) {
    player.lastActionTurn = state.turn;
  }
  return result;
}

function handleVote(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.voteOption) return false;

  const vote = state.pendingVotes[state.pendingVotes.length - 1];
  if (!vote) return false;

  vote.votes[playerId] = action.voteOption;
  state.players[playerId].lastActionTurn = state.turn;

  const totalPlayers = Object.keys(state.players).length;
  const votesCast = Object.keys(vote.votes).length;
  if (votesCast >= totalPlayers) {
    resolveVote(state, vote);
  }

  return true;
}

function resolveVote(state: GameState, vote: { eventId: string; options: string[]; votes: Record<string, string> }): void {
  const voteCounts: Record<string, number> = {};
  for (const option of vote.options) {
    voteCounts[option] = 0;
  }

  for (const playerVote of Object.values(vote.votes)) {
    if (voteCounts[playerVote] !== undefined) {
      voteCounts[playerVote]++;
    }
  }

  let winner = vote.options[0];
  let maxVotes = 0;
  for (const [option, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winner = option;
    }
  }

  addLog(state, `投票结果: ${winner} (${maxVotes}票)`, 'info');

  const event = state.events.find(e => e.id === vote.eventId);
  if (event && event.type === 'mysteriousSignal') {
    const { resolveMysteriousSignal } = require('./events');
    resolveMysteriousSignal(state, winner === '调查');
  }

  state.pendingVotes = state.pendingVotes.filter(v => v.eventId !== vote.eventId);
}

function checkAfkPlayers(state: GameState): void {
  for (const player of Object.values(state.players)) {
    if (player.lastActionTurn < state.turn - 1) {
      player.afkTurns++;
      if (player.afkTurns >= AFK_TURNS_BEFORE_TAKEOVER) {
        player.isAFK = true;
        for (const moduleId of player.assignedModules) {
          state.modules[moduleId].powerLevel = 1;
        }
        addLog(state, `${player.name} 连续挂机 ${player.afkTurns} 回合，模块已降为最低功耗`, 'warning');
      }
    } else {
      player.afkTurns = 0;
      player.isAFK = false;
    }
  }
}

export function autoAssignCrew(state: GameState): void {
  const unassignedColonists = Object.values(state.colonists).filter(c => !c.assignedModule && c.health > 0 && !c.isMutineer && !c.isFrozen);

  for (const module of Object.values(state.modules)) {
    const needed = module.crewRequired - module.crewAssigned.length;
    if (needed <= 0) continue;

    const matchingSkill = MODULE_SKILL_MATCH[module.id];
    const skilledColonists = unassignedColonists
      .filter(c => c.skills[matchingSkill] > 0)
      .sort((a, b) => b.skills[matchingSkill] - a.skills[matchingSkill]);

    const others = unassignedColonists.filter(c => c.skills[matchingSkill] === 0);
    const candidates = [...skilledColonists, ...others];

    for (let i = 0; i < Math.min(needed, candidates.length); i++) {
      const colonist = candidates[i];
      colonist.assignedModule = module.id;
      module.crewAssigned.push(colonist.id);
      const idx = unassignedColonists.indexOf(colonist);
      if (idx > -1) unassignedColonists.splice(idx, 1);
    }
  }
}

function handleChangeShiftMode(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.moduleId || !action.shiftMode) return false;
  if (!canPlayerModifyModule(state, playerId, action.moduleId)) return false;

  const validModes: ShiftMode[] = ['continuous', 'threeShift', 'flexible'];
  if (!validModes.includes(action.shiftMode)) return false;

  const success = changeModuleShiftMode(state, action.moduleId, action.shiftMode);
  if (success) {
    state.players[playerId].lastActionTurn = state.turn;
    updateModuleEfficiencies(state);
  }
  return success;
}

function handleReassignShiftGroup(state: GameState, playerId: string, action: PlayerAction): boolean {
  if (!action.moduleId || !action.colonistId || !action.shiftGroup) return false;
  if (!canPlayerModifyModule(state, playerId, action.moduleId)) return false;

  const validGroups: ShiftGroup[] = ['A', 'B', 'C'];
  if (!validGroups.includes(action.shiftGroup)) return false;

  const success = reassignColonistShiftGroup(state, action.moduleId, action.colonistId, action.shiftGroup);
  if (success) {
    state.players[playerId].lastActionTurn = state.turn;
  }
  return success;
}

export function applyBatchPlayerAction(
  state: GameState,
  playerId: string,
  action: BatchPlayerAction
): BatchActionResult {
  const result: BatchActionResult = {
    successCount: 0,
    failureCount: 0,
    failures: [],
  };

  if (action.type === 'batchAssign') {
    const { moduleId, colonistIds } = action;
    if (!canPlayerModifyModule(state, playerId, moduleId)) {
      for (const cid of colonistIds) {
        const c = state.colonists[cid];
        result.failureCount++;
        result.failures.push({
          colonistId: cid,
          colonistName: c?.name || '未知',
          reason: '无权限操作该模块',
        });
      }
      return result;
    }

    const module = state.modules[moduleId];
    if (!module) {
      for (const cid of colonistIds) {
        const c = state.colonists[cid];
        result.failureCount++;
        result.failures.push({
          colonistId: cid,
          colonistName: c?.name || '未知',
          reason: '模块不存在',
        });
      }
      return result;
    }

    for (const cid of colonistIds) {
      const colonist = state.colonists[cid];
      if (!colonist) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: '未知', reason: '殖民者不存在' });
        continue;
      }
      if (colonist.health <= 0) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '已死亡' });
        continue;
      }
      if (colonist.isMutineer) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '叛变中' });
        continue;
      }
      if (colonist.isFrozen) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '冷冻中' });
        continue;
      }

      if (colonist.assignedModule) {
        const oldModule = state.modules[colonist.assignedModule as ModuleType];
        if (oldModule) {
          oldModule.crewAssigned = oldModule.crewAssigned.filter(id => id !== colonist.id);
        }
      }

      colonist.assignedModule = moduleId;
      module.crewAssigned.push(colonist.id);
      result.successCount++;
    }

    if (result.successCount > 0) {
      state.players[playerId].lastActionTurn = state.turn;
    }
  } else if (action.type === 'batchUnassign') {
    const { colonistIds } = action;

    for (const cid of colonistIds) {
      const colonist = state.colonists[cid];
      if (!colonist || !colonist.assignedModule) {
        if (colonist) {
          result.failureCount++;
          result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '未分配' });
        } else {
          result.failureCount++;
          result.failures.push({ colonistId: cid, colonistName: '未知', reason: '殖民者不存在' });
        }
        continue;
      }

      const moduleId = colonist.assignedModule as ModuleType;
      if (!canPlayerModifyModule(state, playerId, moduleId)) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '无权限操作该模块' });
        continue;
      }

      const module = state.modules[moduleId];
      if (!module) {
        result.failureCount++;
        result.failures.push({ colonistId: cid, colonistName: colonist.name, reason: '模块不存在' });
        continue;
      }

      module.crewAssigned = module.crewAssigned.filter(id => id !== colonist.id);
      colonist.assignedModule = null;
      result.successCount++;
    }

    if (result.successCount > 0) {
      state.players[playerId].lastActionTurn = state.turn;
    }
  }

  return result;
}
