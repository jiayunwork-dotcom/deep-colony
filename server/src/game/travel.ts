import type { GameState } from '@deep-colony/shared';
import { addLog, calculateModuleEfficiency } from './state';
import {
  DISTANCE_PER_LEVEL,
  TOTAL_DISTANCE,
  RELAY_STATIONS,
  SLINGSHOT_BONUS_MIN,
  SLINGSHOT_BONUS_MAX,
  SLINGSHOT_METEOR_CHANCE,
} from '@deep-colony/shared';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function processTravel(state: GameState): void {
  if (state.resources.fuel <= 0) {
    addLog(state, '燃料耗尽，飞船无法前进！', 'danger');
    return;
  }

  const engineEff = calculateModuleEfficiency(state.modules.mainEngine, state.colonists);
  let distance = state.modules.mainEngine.powerLevel * DISTANCE_PER_LEVEL * (state.modules.mainEngine.durability / 100) * engineEff;

  if (state.techTree.aiPiloting?.researched) {
    distance *= 1 + state.techTree.aiPiloting.effect.value;
  }

  if (state.techTree.warpPrototype?.researched) {
    if (Math.random() < 0.15) {
      addLog(state, '曲速引擎故障！本回合无法使用曲速', 'warning');
    } else {
      distance *= state.techTree.warpPrototype.effect.value;
    }
  }

  state.starMap.currentDistance = Math.min(TOTAL_DISTANCE, state.starMap.currentDistance + distance);
  addLog(state, `飞船前进了 ${distance.toFixed(1)} 单位距离，当前位置: ${state.starMap.currentDistance.toFixed(1)}/${TOTAL_DISTANCE}`, 'info');

  checkRelayStation(state);
}

export function checkRelayStation(state: GameState): void {
  for (const relay of RELAY_STATIONS) {
    if (!state.starMap.visitedRelays.includes(relay) && state.starMap.currentDistance >= relay) {
      state.starMap.visitedRelays.push(relay);
      addLog(state, `到达中继站 (距离 ${relay})！可以选择停靠补给`, 'success');
    }
  }
}

export function dockAtRelay(state: GameState, metalCost: number, fuelGain: number, foodGain: number): void {
  if (state.resources.metal < metalCost) {
    addLog(state, '金属不足，无法进行补给交易', 'warning');
    return;
  }

  state.resources.metal -= metalCost;
  state.resources.fuel += fuelGain;
  state.resources.food += foodGain;
  addLog(state, `在中继站进行补给：消耗 ${metalCost} 金属，获得 ${fuelGain} 燃料和 ${foodGain} 食物`, 'success');
}

export function performGravitySlingshot(state: GameState): boolean {
  const bonus = randomInt(SLINGSHOT_BONUS_MIN, SLINGSHOT_BONUS_MAX);
  state.starMap.currentDistance = Math.min(TOTAL_DISTANCE, state.starMap.currentDistance + bonus);
  addLog(state, `引力弹弓成功！额外前进 ${bonus} 单位距离`, 'success');

  if (Math.random() < SLINGSHOT_METEOR_CHANCE) {
    addLog(state, '引力弹弓期间遭遇陨石！', 'danger');
    return true;
  }

  return false;
}

export function checkVictory(state: GameState): boolean {
  if (state.starMap.currentDistance >= TOTAL_DISTANCE) {
    const aliveColonists = Object.values(state.colonists).filter(c => c.health > 0).length;
    if (aliveColonists > 50) {
      state.phase = 'ended';
      state.winner = true;
      state.finalScore = calculateScore(state);
      addLog(state, `🎉 胜利！飞船安全抵达目的地，存活人口 ${aliveColonists} 人`, 'success');
      return true;
    } else {
      state.phase = 'ended';
      state.winner = false;
      addLog(state, `💀 失败！虽然到达了目的地，但存活人口不足50人（仅 ${aliveColonists} 人）`, 'danger');
      return true;
    }
  }
  return false;
}

export function checkDefeat(state: GameState): boolean {
  const aliveColonists = Object.values(state.colonists).filter(c => c.health > 0).length;
  if (aliveColonists <= 0) {
    state.phase = 'ended';
    state.winner = false;
    addLog(state, '💀 失败！所有殖民者全部死亡', 'danger');
    return true;
  }

  const allModulesDead = Object.values(state.modules).every(m => m.durability <= 0);
  if (allModulesDead) {
    state.phase = 'ended';
    state.winner = false;
    addLog(state, '💀 失败！所有模块全部瘫痪', 'danger');
    return true;
  }

  if (state.resources.fuel <= 0) {
    const atRelay = RELAY_STATIONS.some(r => Math.abs(state.starMap.currentDistance - r) < 10);
    if (!atRelay) {
      state.phase = 'ended';
      state.winner = false;
      addLog(state, '💀 失败！燃料耗尽且不在中继站附近', 'danger');
      return true;
    }
  }

  return false;
}

export function calculateScore(state: GameState): number {
  const aliveColonists = Object.values(state.colonists).filter(c => c.health > 0).length;
  const populationScore = aliveColonists * 2;

  const resourceScore = (state.resources.food + state.resources.water + state.resources.fuel + state.resources.metal + state.resources.oxygen) * 0.5;

  const researchedCount = Object.values(state.techTree).filter(t => t.researched).length;
  const techScore = researchedCount * 20;

  const efficiencyBonus = Math.max(0, (200 - state.turn) * 5);

  return Math.floor(populationScore + resourceScore + techScore + efficiencyBonus);
}
