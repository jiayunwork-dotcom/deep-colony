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
  const oxygenProduced = state.modules.lifeSupport.powerLevel * OXYGEN_PRODUCTION_PER_LEVEL * lifeSupportEff;
  state.resources.oxygen += oxygenProduced;

  const waterCycleEff = calculateModuleEfficiency(state.modules.waterCycle, state.colonists);
  const waterConsumed = population * WATER_PER_PERSON;
  const recoveryRate = BASE_WATER_RECOVERY + state.modules.waterCycle.powerLevel * WATER_RECOVERY_PER_LEVEL;
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

  addLog(state, `本回合产出: 氧气+${oxygenProduced.toFixed(0)}, 食物+${foodProduced.toFixed(0)}, 科技点+${techPointsGained.toFixed(1)}`, 'info');
  addLog(state, `本回合消耗: 燃料-${fuelConsumed.toFixed(0)}, 人口${population}人`, 'info');
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
  if (quartersEff > 0.5) {
    for (const colonist of activeColonists) {
      if (colonist.health > 0) {
        colonist.morale += 1 * quartersEff;
      }
    }
  }

  const medicalEff = calculateModuleEfficiency(state.modules.medicalBay, state.colonists);
  if (medicalEff > 0) {
    for (const colonist of activeColonists) {
      if (colonist.health > 0 && colonist.health < colonist.maxHealth && !colonist.isInfected) {
        colonist.health += 1 * medicalEff;
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
