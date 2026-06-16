import { v4 as uuidv4 } from 'uuid';
import type { GameState, Colonist } from '@deep-colony/shared';
import {
  OXYGEN_PRODUCTION_PER_LEVEL,
  BASE_WATER_RECOVERY,
  WATER_RECOVERY_PER_LEVEL,
  FOOD_PRODUCTION_PER_LEVEL,
  FUEL_CONSUMPTION_PER_LEVEL,
  FOOD_PER_PERSON,
  WATER_PER_PERSON,
  OXYGEN_PER_PERSON,
  WASTE_PER_PERSON,
  TECH_POINTS_PER_LEVEL,
  FACTORY_METAL_PER_LEVEL,
  FACTORY_PARTS_PER_LEVEL,
  REPAIR_PARTS_PER_MODULE,
  REPAIR_AMOUNT_WITH_PARTS,
  COMMUNICATION_SCAN_RANGE,
  COMMUNICATION_RESOURCE_BONUS_CHANCE,
  COMMUNICATION_CALL_INTERVAL,
} from '@deep-colony/shared';
import { addLog, calculateModuleEfficiency } from './state';

function getActiveColonists(state: GameState): Colonist[] {
  return Object.values(state.colonists).filter(c => !c.isFrozen && c.health > 0);
}

export function calculateTotalPowerConsumption(state: GameState): number {
  let total = 0;
  for (const module of Object.values(state.modules)) {
    total += module.powerLevel;
  }
  return total;
}

export function getMaxElectricity(state: GameState): number {
  let max = state.resources.maxElectricity;
  if (state.techTree.efficientSolarPanels?.researched) {
    max *= 1 + state.techTree.efficientSolarPanels.effect.value;
  }
  return Math.floor(max);
}

export function processResourceProduction(state: GameState): void {
  const activeColonists = getActiveColonists(state);
  const population = activeColonists.length;

  const lifeSupportEff = calculateModuleEfficiency(state.modules.lifeSupport, state.colonists);
  let oxygenProduced = state.modules.lifeSupport.powerLevel * OXYGEN_PRODUCTION_PER_LEVEL * lifeSupportEff;
  if (state.techTree.efficientOxygenCycler?.researched) {
    oxygenProduced *= 1 + state.techTree.efficientOxygenCycler.effect.value;
  }
  state.resources.oxygen += oxygenProduced;

  const waterCycleEff = calculateModuleEfficiency(state.modules.waterCycle, state.colonists);
  const waterConsumed = population * WATER_PER_PERSON;
  let recoveryRate = BASE_WATER_RECOVERY + state.modules.waterCycle.powerLevel * WATER_RECOVERY_PER_LEVEL;
  if (state.techTree.distillationPurification?.researched) {
    recoveryRate += state.techTree.distillationPurification.effect.value;
  }
  const waterRecovered = waterConsumed * recoveryRate * waterCycleEff;
  state.resources.water += waterRecovered - waterConsumed;
  if (state.resources.water < 0) state.resources.water = 0;

  const farmEff = calculateModuleEfficiency(state.modules.farm, state.colonists);
  let foodProduced = state.modules.farm.powerLevel * FOOD_PRODUCTION_PER_LEVEL * farmEff;
  if (state.techTree.geneticallyEnhancedCrops?.researched) {
    foodProduced *= 1 + state.techTree.geneticallyEnhancedCrops.effect.value;
  }
  state.resources.food += foodProduced;

  const foodConsumed = population * FOOD_PER_PERSON;
  state.resources.food -= foodConsumed;
  if (state.resources.food < 0) state.resources.food = 0;

  const oxygenConsumed = population * OXYGEN_PER_PERSON;
  state.resources.oxygen -= oxygenConsumed;
  if (state.resources.oxygen < 0) state.resources.oxygen = 0;

  const wasteProduced = population * WASTE_PER_PERSON;
  state.resources.waste += wasteProduced;

  const engineEff = calculateModuleEfficiency(state.modules.mainEngine, state.colonists);
  const fuelConsumed = state.modules.mainEngine.powerLevel * FUEL_CONSUMPTION_PER_LEVEL * engineEff;
  state.resources.fuel -= fuelConsumed;
  if (state.resources.fuel < 0) state.resources.fuel = 0;

  const labEff = calculateModuleEfficiency(state.modules.laboratory, state.colonists);
  const techPointsGained = state.modules.laboratory.powerLevel * TECH_POINTS_PER_LEVEL * labEff;
  state.techPoints += techPointsGained;

  const factoryEff = calculateModuleEfficiency(state.modules.factory, state.colonists);
  let metalConsumed = state.modules.factory.powerLevel * FACTORY_METAL_PER_LEVEL * factoryEff;
  let partsProduced = state.modules.factory.powerLevel * FACTORY_PARTS_PER_LEVEL * factoryEff;
  if (state.techTree.precisionManufacturing?.researched) {
    partsProduced *= 1 + state.techTree.precisionManufacturing.effect.value;
  }
  const actualMetalConsumed = Math.min(metalConsumed, state.resources.metal);
  const actualPartsProduced = partsProduced * (state.resources.metal > 0 ? actualMetalConsumed / metalConsumed : 0);
  state.resources.metal -= actualMetalConsumed;
  state.resources.repairParts = Math.min(
    state.resources.maxRepairParts,
    state.resources.repairParts + actualPartsProduced
  );

  if (state.techTree.metalMolecularReconstruction?.researched) {
    state.resources.metal += state.techTree.metalMolecularReconstruction.effect.value;
  }
  if (state.techTree.bioCycleReactor?.researched && state.resources.waste > 0) {
    const converted = Math.min(state.resources.waste, state.resources.waste * state.techTree.bioCycleReactor.effect.value);
    state.resources.waste -= converted;
    state.resources.food += converted;
    addLog(state, `生物反应堆将 ${converted.toFixed(0)} 废物转化为食物`, 'success');
  }

  processFactoryRepairs(state);

  const commEff = calculateModuleEfficiency(state.modules.communication, state.colonists);
  processCommunication(state, commEff);

  addLog(state, `本回合产出: 氧气+${oxygenProduced.toFixed(0)}, 食物+${foodProduced.toFixed(0)}, 科技点+${techPointsGained.toFixed(1)}, 零件+${actualPartsProduced.toFixed(0)}`, 'info');
  addLog(state, `本回合消耗: 燃料-${fuelConsumed.toFixed(0)}, 金属-${actualMetalConsumed.toFixed(0)}, 人口${population}人`, 'info');
}

function processFactoryRepairs(state: GameState): void {
  const damagedModules = Object.values(state.modules).filter(
    m => m.durability < m.maxDurability && m.durability > 0
  );

  if (damagedModules.length === 0 || state.resources.repairParts <= 0) return;

  damagedModules.sort((a, b) => a.durability - b.durability);

  for (const module of damagedModules) {
    if (state.resources.repairParts < REPAIR_PARTS_PER_MODULE) break;

    state.resources.repairParts -= REPAIR_PARTS_PER_MODULE;
    const previousDurability = module.durability;
    module.durability = Math.min(module.maxDurability, module.durability + REPAIR_AMOUNT_WITH_PARTS);
    addLog(state, `工厂修复了 ${module.name}，耐久度 ${previousDurability.toFixed(0)} → ${module.durability.toFixed(0)}`, 'success');
  }
}

function processCommunication(state: GameState, efficiency: number): void {
  if (efficiency <= 0) return;

  if (Math.random() < COMMUNICATION_RESOURCE_BONUS_CHANCE * efficiency) {
    const resourceTypes = ['food', 'metal', 'fuel', 'water'];
    const type = resourceTypes[Math.floor(Math.random() * resourceTypes.length)] as 'food' | 'metal' | 'fuel' | 'water';
    const amount = Math.floor((15 + Math.random() * 25) * efficiency);
    const names: Record<string, string> = { food: '食物', metal: '金属', fuel: '燃料', water: '水' };
    state.resources[type] += amount;
    addLog(state, `📡 通信模块与母星联络成功，获得 ${amount} 单位${names[type]}补给`, 'success');
  }

  const scanDistance = Math.floor(COMMUNICATION_SCAN_RANGE * efficiency);
  const current = state.starMap.currentDistance;
  const dangerousZones: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const dist = current + i * 20;
    if (dist < current + scanDistance && Math.random() < 0.2) {
      dangerousZones.push(Math.floor(dist));
    }
  }
  if (dangerousZones.length > 0 && efficiency > 0.3) {
    addLog(state, `📡 通信扫描警告: 在距离 ${dangerousZones.join(', ')} 附近探测到太空碎片，请留意防御系统`, 'warning');
  }
}

export function processColonistStatus(state: GameState): void {
  const activeColonists = Object.values(state.colonists).filter(c => c.health > 0);

  for (const colonist of activeColonists) {
    if (colonist.isInfected && colonist.infectionTurnsLeft > 0) {
      const medicalEff = calculateModuleEfficiency(state.modules.medicalBay, state.colonists);
      const damage = 5 * (1 - medicalEff * 0.5);
      colonist.health -= damage;
      colonist.infectionTurnsLeft--;
      if (colonist.infectionTurnsLeft <= 0) {
        colonist.isInfected = false;
      }
    }

    if (colonist.isMutineer && colonist.mutinyTurnsLeft > 0) {
      colonist.mutinyTurnsLeft--;
      if (colonist.mutinyTurnsLeft <= 0) {
        colonist.isMutineer = false;
      }
    }

    if (state.resources.food <= 0) {
      colonist.health -= 3;
      colonist.morale -= 5;
    }
    if (state.resources.water <= 0) {
      colonist.health -= 5;
      colonist.morale -= 8;
    }
    if (state.resources.oxygen <= 0) {
      colonist.health -= 10;
    }

    if (state.resources.waste > state.resources.maxWaste) {
      colonist.health -= 2;
    }

    if (colonist.health <= 0) {
      colonist.health = 0;
      addLog(state, `殖民者 ${colonist.name} 不幸去世`, 'danger');
    }

    colonist.morale = Math.max(0, Math.min(100, colonist.morale));
    colonist.health = Math.max(0, Math.min(colonist.maxHealth, colonist.health));

    colonist.age += 1 / 12;
  }

  const quartersEff = calculateModuleEfficiency(state.modules.quarters, state.colonists);
  let moraleBonus = 0;
  if (state.techTree.psychologicalCounseling?.researched) {
    moraleBonus = state.techTree.psychologicalCounseling.effect.value;
  }
  if (quartersEff > 0.5 || moraleBonus > 0) {
    for (const colonist of activeColonists) {
      if (colonist.health > 0) {
        colonist.morale += 1 * quartersEff + moraleBonus;
      }
    }
  }

  const medicalEff = calculateModuleEfficiency(state.modules.medicalBay, state.colonists);
  let healMultiplier = 1;
  if (state.techTree.nanoMedicalBots?.researched) {
    healMultiplier = 1 + state.techTree.nanoMedicalBots.effect.value;
  }
  if (medicalEff > 0) {
    for (const colonist of activeColonists) {
      if (colonist.health > 0 && colonist.health < colonist.maxHealth && !colonist.isInfected) {
        colonist.health += 1 * medicalEff * healMultiplier;
      }
    }
  }
}

export function processPopulationGrowth(state: GameState): void {
  const activeColonists = Object.values(state.colonists).filter(
    c => c.health > 0 && !c.isFrozen && c.health > 80 && c.age >= 20 && c.age <= 40
  );

  const pairs = Math.floor(activeColonists.length / 2);
  for (let i = 0; i < pairs; i++) {
    if (Math.random() < 0.05) {
      const newColonist = {
        id: uuidv4(),
        name: '新出生' + Math.floor(Math.random() * 1000),
        health: 100,
        maxHealth: 100,
        morale: 80,
        age: 0,
        skills: { engineering: 0, medical: 0, agriculture: 0, science: 0, military: 0 },
        assignedModule: null,
        isMutineer: false,
        mutinyTurnsLeft: 0,
        isInfected: false,
        infectionTurnsLeft: 0,
        isFrozen: false,
        statsHistory: [{ turn: state.turn, health: 100, morale: 80 }],
      };
      state.colonists[newColonist.id] = newColonist;
      addLog(state, `有新殖民者诞生了！`, 'success');
    }
  }
}

export function processAutoRepair(state: GameState): void {
  if (!state.techTree.nanoRepairBots?.researched) return;

  const repairAmount = state.techTree.nanoRepairBots.effect.value;
  for (const module of Object.values(state.modules)) {
    if (module.durability < module.maxDurability && module.durability > 0) {
      module.durability = Math.min(module.maxDurability, module.durability + repairAmount);
    }
  }
}

export function checkPowerBalance(state: GameState): boolean {
  const totalPower = calculateTotalPowerConsumption(state);
  const maxPower = getMaxElectricity(state);
  return totalPower <= maxPower;
}

export function forcePowerReduction(state: GameState): void {
  const maxPower = getMaxElectricity(state);
  const moduleOrder = [
    'laboratory', 'factory', 'communication', 'quarters', 'farm',
    'medicalBay', 'waterCycle', 'lifeSupport', 'defense', 'mainEngine'
  ] as const;

  while (calculateTotalPowerConsumption(state) > maxPower) {
    let reduced = false;
    for (const moduleId of moduleOrder) {
      if (state.modules[moduleId].powerLevel > 1) {
        state.modules[moduleId].powerLevel--;
        reduced = true;
        break;
      }
    }
    if (!reduced) break;
  }
}
