import type { GameState, GameEvent, ModuleType } from '@deep-colony/shared';
import { addLog, calculateModuleEfficiency, checkModuleEmergencyStatus } from './state';
import type { SkillProcessingResult } from './skillTree';
import { getModuleResistanceBonus } from './skillTree';
import {
  METEOR_DAMAGE_MIN,
  METEOR_DAMAGE_MAX,
  SYSTEM_FAILURE_DAMAGE,
  DISEASE_DAMAGE_PER_TURN,
  DISEASE_BASE_DURATION,
  FOOD_SPOILAGE_RATIO,
  MUTINY_CREW_COUNT,
  MUTINY_DURATION,
  MUTINY_MORALE_THRESHOLD,
  MYSTERIOUS_SIGNAL_GOOD_CHANCE,
  BASE_EVENT_PROBABILITY,
  DISASTER_CHAIN_EVENT_PROBABILITY,
} from '@deep-colony/shared';
import { v4 as uuidv4 } from 'uuid';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomModule(state: GameState): ModuleType {
  const modules = Object.keys(state.modules) as ModuleType[];
  return modules[randomInt(0, modules.length - 1)];
}

export function triggerRandomEvent(state: GameState, isDisasterChain: boolean = false, skillResult?: SkillProcessingResult): void {
  const probability = isDisasterChain ? DISASTER_CHAIN_EVENT_PROBABILITY : BASE_EVENT_PROBABILITY;
  if (Math.random() > probability) return;

  const eventPool = [
    { type: 'meteorStrike', weight: 15 },
    { type: 'systemFailure', weight: 15 },
    { type: 'diseaseOutbreak', weight: 12 },
    { type: 'foodSpoilage', weight: 10 },
    { type: 'mutiny', weight: 8 },
    { type: 'mysteriousSignal', weight: 10 },
    { type: 'solarStorm', weight: 8 },
  ];

  if (!isDisasterChain) {
    eventPool.push({ type: 'supplyPod', weight: 12 });
  }

  const totalWeight = eventPool.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedType = eventPool[0].type;

  for (const event of eventPool) {
    random -= event.weight;
    if (random <= 0) {
      selectedType = event.type;
      break;
    }
  }

  createEvent(state, selectedType as any, skillResult);
}

export function createEvent(state: GameState, type: GameEvent['type'], skillResult?: SkillProcessingResult): GameEvent {
  let event: GameEvent;

  switch (type) {
    case 'meteorStrike':
      event = createMeteorStrikeEvent(state);
      break;
    case 'systemFailure':
      event = createSystemFailureEvent(state);
      break;
    case 'diseaseOutbreak':
      event = createDiseaseOutbreakEvent(state);
      break;
    case 'foodSpoilage':
      event = createFoodSpoilageEvent(state);
      break;
    case 'mutiny':
      event = createMutinyEvent(state);
      break;
    case 'mysteriousSignal':
      event = createMysteriousSignalEvent(state);
      break;
    case 'solarStorm':
      event = createSolarStormEvent(state);
      break;
    case 'supplyPod':
      event = createSupplyPodEvent(state);
      break;
    default:
      event = createSupplyPodEvent(state);
  }

  state.events.push(event);
  if (event.needsVote) {
    state.pendingVotes.push({
      eventId: event.id,
      options: event.voteOptions || [],
      votes: {},
      expiresAtTurn: state.turn + 1,
    });
  }

  if (!event.needsVote) {
    applyEventEffect(state, event, skillResult);
    state.activeEvents.push(event);
  }

  addLog(state, `事件发生: ${event.name} - ${event.description}`, 'warning');

  return event;
}

function createMeteorStrikeEvent(state: GameState): GameEvent {
  const targetModule = getRandomModule(state);
  let damage = randomInt(METEOR_DAMAGE_MIN, METEOR_DAMAGE_MAX);

  const defenseEff = calculateModuleEfficiency(state.modules.defense, state.colonists);
  let defenseReduction = defenseEff * 0.3;
  if (state.techTree.reinforcedArmor?.researched) {
    defenseReduction *= 1 + state.techTree.reinforcedArmor.effect.value;
  }
  damage = Math.floor(damage * (1 - defenseReduction));

  if (state.techTree.shieldUpgrade?.researched) {
    damage = Math.floor(damage * (1 - state.techTree.shieldUpgrade.effect.value));
  }

  return {
    id: uuidv4(),
    type: 'meteorStrike',
    name: '陨石撞击',
    description: `陨石撞击了 ${state.modules[targetModule].name}，造成 ${damage} 点伤害`,
    turnsRemaining: 0,
    affectedModules: [targetModule],
    needsVote: false,
    resolved: true,
  };
}

function createSystemFailureEvent(state: GameState): GameEvent {
  const targetModule = getRandomModule(state);
  return {
    id: uuidv4(),
    type: 'systemFailure',
    name: '系统故障',
    description: `${state.modules[targetModule].name} 发生故障，耐久度降低 ${SYSTEM_FAILURE_DAMAGE}`,
    turnsRemaining: 0,
    affectedModules: [targetModule],
    needsVote: false,
    resolved: true,
  };
}

function createDiseaseOutbreakEvent(state: GameState): GameEvent {
  const medicalEff = calculateModuleEfficiency(state.modules.medicalBay, state.colonists);
  const duration = Math.max(1, Math.floor(DISEASE_BASE_DURATION * (1 - medicalEff * 0.3)));

  return {
    id: uuidv4(),
    type: 'diseaseOutbreak',
    name: '传染病爆发',
    description: `传染病在船内蔓延，感染者健康值每回合降低 ${DISEASE_DAMAGE_PER_TURN}，持续 ${duration} 回合`,
    turnsRemaining: duration,
    needsVote: false,
    resolved: false,
  };
}

function createFoodSpoilageEvent(state: GameState): GameEvent {
  const lossAmount = Math.floor(state.resources.food * FOOD_SPOILAGE_RATIO);
  return {
    id: uuidv4(),
    type: 'foodSpoilage',
    name: '食物腐坏',
    description: `部分食物腐坏，损失 ${lossAmount} 单位食物`,
    turnsRemaining: 0,
    needsVote: false,
    resolved: true,
  };
}

function createMutinyEvent(state: GameState): GameEvent {
  const lowMoraleColonists = Object.values(state.colonists)
    .filter(c => c.health > 0 && !c.isFrozen && c.morale < MUTINY_MORALE_THRESHOLD + 20)
    .sort((a, b) => a.morale - b.morale)
    .slice(0, MUTINY_CREW_COUNT);

  const militaryCount = Object.values(state.colonists).filter(
    c => c.health > 0 && !c.isFrozen && c.skills.military >= 3
  ).length;

  const duration = militaryCount > 0 ? 1 : MUTINY_DURATION;

  return {
    id: uuidv4(),
    type: 'mutiny',
    name: '船员叛变',
    description: `${lowMoraleColonists.length} 名士气低落的船员拒绝工作，持续 ${duration} 回合`,
    turnsRemaining: duration,
    affectedColonists: lowMoraleColonists.map(c => c.id),
    needsVote: false,
    resolved: false,
  };
}

function createMysteriousSignalEvent(state: GameState): GameEvent {
  return {
    id: uuidv4(),
    type: 'mysteriousSignal',
    name: '神秘信号',
    description: '接收到一段神秘信号，是否派出调查小队？',
    turnsRemaining: 0,
    needsVote: true,
    voteOptions: ['调查', '忽略'],
    resolved: false,
  };
}

function createSolarStormEvent(state: GameState): GameEvent {
  return {
    id: uuidv4(),
    type: 'solarStorm',
    name: '太阳风暴',
    description: '强烈的太阳风暴袭来，全船电力系统受到干扰，本回合无法操作',
    turnsRemaining: 1,
    needsVote: false,
    resolved: false,
  };
}

function createSupplyPodEvent(state: GameState): GameEvent {
  const resources = ['食物', '水', '金属', '燃料'];
  const resource = resources[randomInt(0, resources.length - 1)];
  const amount = randomInt(30, 80);
  return {
    id: uuidv4(),
    type: 'supplyPod',
    name: '补给舱漂流物',
    description: `发现漂流的补给舱，获得 ${amount} 单位${resource}`,
    turnsRemaining: 0,
    needsVote: false,
    resolved: true,
  };
}

export function applyEventEffect(state: GameState, event: GameEvent, skillResult?: SkillProcessingResult): void {
  switch (event.type) {
    case 'meteorStrike':
      if (event.affectedModules) {
        for (const moduleId of event.affectedModules) {
          const module = state.modules[moduleId];
          const damageMatch = event.description.match(/造成 (\d+) 点伤害/);
          const damage = damageMatch ? parseInt(damageMatch[1]) : METEOR_DAMAGE_MIN;
          const previousDurability = module.durability;
          module.durability = Math.max(0, module.durability - damage);
          checkModuleEmergencyStatus(state, moduleId, previousDurability);
        }
      }
      break;
    case 'systemFailure':
      if (event.affectedModules) {
        for (const moduleId of event.affectedModules) {
          const previousDurability = state.modules[moduleId].durability;
          state.modules[moduleId].durability = Math.max(
            0,
            state.modules[moduleId].durability - SYSTEM_FAILURE_DAMAGE
          );
          checkModuleEmergencyStatus(state, moduleId, previousDurability);
        }
      }
      break;
    case 'diseaseOutbreak':
      const infectedCount = Math.floor(Object.keys(state.colonists).length * 0.3);
      const colonistIds = Object.keys(state.colonists);
      const shuffled = colonistIds.sort(() => Math.random() - 0.5);
      let actualInfected = 0;
      for (let i = 0; i < Math.min(infectedCount * 2, shuffled.length) && actualInfected < infectedCount; i++) {
        const colonist = state.colonists[shuffled[i]];
        if (colonist.health > 0 && !colonist.isFrozen && !colonist.isInfected) {
          let infected = true;
          const colonistEffects = skillResult?.colonistEffects[colonist.id];
          if (colonistEffects) {
            const resistance = getModuleResistanceBonus(colonistEffects, 'medicalBay');
            if (Math.random() < resistance / 100) {
              infected = false;
              addLog(state, `💪 ${colonist.name} 凭借强健身躯抵抗住了感染`, 'success');
            }
          }
          if (infected) {
            colonist.isInfected = true;
            colonist.infectionTurnsLeft = event.turnsRemaining;
            actualInfected++;
          }
        }
      }
      break;
    case 'foodSpoilage':
      state.resources.food = Math.floor(state.resources.food * (1 - FOOD_SPOILAGE_RATIO));
      break;
    case 'mutiny':
      if (event.affectedColonists) {
        for (const colonistId of event.affectedColonists) {
          const colonist = state.colonists[colonistId];
          if (colonist) {
            let mutiny = true;
            const colonistEffects = skillResult?.colonistEffects[colonist.id];
            if (colonistEffects) {
              const resistance = getModuleResistanceBonus(colonistEffects, 'defense');
              if (Math.random() < resistance / 100) {
                mutiny = false;
                addLog(state, `🛡️ ${colonist.name} 保持冷静，没有参与叛变`, 'success');
              }
            }
            if (mutiny) {
              colonist.isMutineer = true;
              colonist.mutinyTurnsLeft = event.turnsRemaining;
            }
          }
        }
      }
      break;
    case 'solarStorm':
      break;
    case 'supplyPod':
      const amountMatch = event.description.match(/获得 (\d+) 单位/);
      const amount = amountMatch ? parseInt(amountMatch[1]) : 50;
      if (event.description.includes('食物')) {
        state.resources.food += amount;
      } else if (event.description.includes('水')) {
        state.resources.water += amount;
      } else if (event.description.includes('金属')) {
        state.resources.metal += amount;
      } else if (event.description.includes('燃料')) {
        state.resources.fuel += amount;
      }
      break;
  }
}

export function resolveMysteriousSignal(state: GameState, investigate: boolean): void {
  const event = state.events.find(e => e.type === 'mysteriousSignal' && !e.resolved);
  if (!event) return;

  event.resolved = true;

  if (investigate) {
    if (Math.random() < MYSTERIOUS_SIGNAL_GOOD_CHANCE) {
      const techBonus = randomInt(20, 50);
      state.techPoints += techBonus;
      addLog(state, `神秘信号调查成功！获得 ${techBonus} 科技点`, 'success');
    } else {
      const damage = randomInt(10, 30);
      const targetModule = getRandomModule(state);
      const previousDurability = state.modules[targetModule].durability;
      state.modules[targetModule].durability = Math.max(0, state.modules[targetModule].durability - damage);
      checkModuleEmergencyStatus(state, targetModule, previousDurability);
      addLog(state, `神秘信号调查遭遇危险！${state.modules[targetModule].name} 受损 ${damage} 点`, 'danger');
    }
  } else {
    addLog(state, '忽略了神秘信号，继续航行', 'info');
  }
}

export function processActiveEvents(state: GameState): void {
  const eventsToRemove: string[] = [];

  for (const event of state.activeEvents) {
    if (event.turnsRemaining > 0) {
      event.turnsRemaining--;
    }

    if (event.turnsRemaining <= 0 && !event.needsVote) {
      eventsToRemove.push(event.id);
    }
  }

  state.activeEvents = state.activeEvents.filter(e => !eventsToRemove.includes(e.id));
}
