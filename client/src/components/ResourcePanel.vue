<template>
  <div class="resource-panel">
    <div class="ship-health">
      <div class="health-header">
        <span class="health-label">🚀 飞船整体健康度</span>
        <span class="health-value" :class="healthClass">{{ shipHealth.toFixed(1) }}%</span>
      </div>
      <div class="health-bar">
        <div
          class="health-fill"
          :class="healthClass"
          :style="{ width: shipHealth + '%' }"
        ></div>
      </div>
    </div>

    <h3>资源状态</h3>
    <div class="resource-list">
      <div class="resource-item">
        <div class="resource-header">
          <span class="resource-name">⚡ 电力</span>
          <span class="resource-value">{{ totalPower.toFixed(0) }}/{{ maxPower }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :class="{ warning: totalPower > maxPower }"
            :style="{ width: Math.min(100, (totalPower / maxPower) * 100) + '%' }"
          ></div>
        </div>
      </div>

      <div v-for="resource in resources" :key="resource.key" class="resource-item">
        <div class="resource-header">
          <span class="resource-name">{{ resource.icon }} {{ resource.name }}</span>
          <span class="resource-value">{{ resource.value.toFixed(0) }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :class="getResourceClass(resource.value, resource.max)"
            :style="{ width: getProgressWidth(resource.value, resource.max) }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/game';
import { SHIP_HEALTH_GREEN_THRESHOLD, SHIP_HEALTH_YELLOW_THRESHOLD } from '@deep-colony/shared';

const gameStore = useGameStore();

const shipHealth = computed(() => {
  if (!gameStore.gameState) return 100;
  const modules = Object.values(gameStore.gameState.modules);
  const totalCurrent = modules.reduce((sum, m) => sum + m.durability, 0);
  const totalMax = modules.reduce((sum, m) => sum + m.maxDurability, 0);
  return (totalCurrent / totalMax) * 100;
});

const healthClass = computed(() => {
  if (shipHealth.value >= SHIP_HEALTH_GREEN_THRESHOLD) return 'good';
  if (shipHealth.value >= SHIP_HEALTH_YELLOW_THRESHOLD) return 'warning';
  return 'danger';
});

const maxPower = computed(() => {
  return gameStore.gameState?.resources.maxElectricity || 25;
});

const totalPower = computed(() => {
  if (!gameStore.gameState) return 0;
  return Object.values(gameStore.gameState.modules).reduce((sum, m) => sum + m.powerLevel, 0);
});

const resources = computed(() => {
  if (!gameStore.gameState) return [];
  const r = gameStore.gameState.resources;
  return [
    { key: 'oxygen', name: '氧气', icon: '💨', value: r.oxygen, max: 1000 },
    { key: 'water', name: '水', icon: '💧', value: r.water, max: 800 },
    { key: 'food', name: '食物', icon: '🍎', value: r.food, max: 600 },
    { key: 'repairParts', name: '维修零件', icon: '🔩', value: r.repairParts, max: r.maxRepairParts },
    { key: 'metal', name: '金属', icon: '⚙️', value: r.metal, max: 500 },
    { key: 'fuel', name: '燃料', icon: '⛽', value: r.fuel, max: 1000 },
    { key: 'waste', name: '废物', icon: '🗑️', value: r.waste, max: r.maxWaste },
  ];
});

function getProgressWidth(value: number, max: number): string {
  return Math.min(100, (value / max) * 100) + '%';
}

function getResourceClass(value: number, max: number): string {
  const ratio = value / max;
  if (ratio < 0.2) return 'danger';
  if (ratio < 0.4) return 'warning';
  return 'normal';
}
</script>

<style scoped>
.resource-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
}

.ship-health {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.health-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.health-value {
  font-size: 18px;
  font-weight: 700;
}

.health-value.good {
  color: var(--accent-green);
}

.health-value.warning {
  color: var(--accent-yellow);
}

.health-value.danger {
  color: var(--accent-red);
}

.health-bar {
  height: 10px;
  background: var(--bg-primary);
  border-radius: 5px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s ease, background-color 0.3s ease;
}

.health-fill.good {
  background: var(--accent-green);
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
}

.health-fill.warning {
  background: var(--accent-yellow);
  box-shadow: 0 0 10px rgba(255, 204, 0, 0.3);
}

.health-fill.danger {
  background: var(--accent-red);
  box-shadow: 0 0 10px rgba(255, 68, 102, 0.3);
  animation: health-pulse 1s infinite;
}

@keyframes health-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.resource-panel h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.resource-name {
  color: var(--text-secondary);
}

.resource-value {
  color: var(--text-primary);
  font-weight: 500;
}

.progress-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-green);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.warning {
  background: var(--accent-yellow);
}

.progress-fill.danger {
  background: var(--accent-red);
}

.progress-fill.normal {
  background: var(--accent-blue);
}
</style>
