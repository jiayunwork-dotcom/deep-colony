<template>
  <div class="starmap-panel">
    <h3>航行进度</h3>
    <div class="starmap">
      <div class="distance-info">
        <span>{{ currentDistance.toFixed(0) }}</span>
        <span>/ {{ totalDistance }} 单位</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        >
          <div class="ship-marker">🚀</div>
        </div>
        <div
          v-for="relay in relayStations"
          :key="relay"
          :class="['relay-marker', { visited: visitedRelays.includes(relay) }]"
          :style="{ left: (relay / totalDistance * 100) + '%' }"
        >
          <div class="relay-icon">📡</div>
          <div class="relay-label">{{ relay }}</div>
        </div>
      </div>
      <div class="labels">
        <span>起点</span>
        <span>目的地</span>
      </div>
    </div>
    <div class="travel-stats">
      <div class="stat-item">
        <span class="stat-label">预计剩余回合</span>
        <span class="stat-value">{{ estimatedTurns }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已访问中继站</span>
        <span class="stat-value">{{ visitedRelays.length }}/{{ relayStations.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/game';
import { TOTAL_DISTANCE, RELAY_STATIONS, DISTANCE_PER_LEVEL } from '@deep-colony/shared';

const gameStore = useGameStore();

const currentDistance = computed(() => {
  return gameStore.gameState?.starMap.currentDistance || 0;
});

const totalDistance = TOTAL_DISTANCE;
const relayStations = RELAY_STATIONS;

const visitedRelays = computed(() => {
  return gameStore.gameState?.starMap.visitedRelays || [];
});

const progressPercent = computed(() => {
  return (currentDistance.value / totalDistance) * 100;
});

const estimatedTurns = computed(() => {
  if (!gameStore.gameState) return '?';
  const engine = gameStore.gameState.modules.mainEngine;
  if (engine.durability <= 0 || engine.powerLevel === 0) return '∞';
  
  const speed = engine.powerLevel * DISTANCE_PER_LEVEL * (engine.durability / 100) * engine.efficiency;
  if (speed <= 0) return '∞';
  
  const remaining = totalDistance - currentDistance.value;
  return Math.ceil(remaining / speed).toString();
});
</script>

<style scoped>
.starmap-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
}

.starmap-panel h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.distance-info {
  text-align: center;
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-cyan);
}

.distance-info span:last-child {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}

.progress-track {
  position: relative;
  height: 30px;
  background: var(--bg-tertiary);
  border-radius: 15px;
  margin-bottom: 8px;
  overflow: visible;
}

.progress-fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan));
  border-radius: 15px;
  transition: width 0.5s ease;
  min-width: 20px;
}

.ship-marker {
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24px;
}

.relay-marker {
  position: absolute;
  top: 100%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.relay-marker.visited .relay-icon {
  filter: grayscale(0);
}

.relay-marker:not(.visited) .relay-icon {
  filter: grayscale(1);
  opacity: 0.5;
}

.relay-icon {
  font-size: 16px;
}

.relay-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.labels {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  font-size: 12px;
  color: var(--text-muted);
}

.travel-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
