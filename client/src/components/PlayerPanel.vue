<template>
  <div class="player-panel">
    <h3>玩家信息</h3>
    <div class="current-player" v-if="currentPlayer">
      <div class="player-avatar">{{ currentPlayer.name.charAt(0) }}</div>
      <div class="player-info">
        <span class="player-name">{{ currentPlayer.name }}</span>
        <span class="player-role">{{ isHost ? '房主' : '玩家' }}</span>
      </div>
    </div>

    <div class="my-modules">
      <h4>我管理的模块</h4>
      <div v-if="myModules.length > 0" class="modules-list">
        <div v-for="module in myModules" :key="module.id" class="mini-module">
          <span class="module-name">{{ module.name }}</span>
          <span class="module-status" :class="getStatusClass(module)">
            {{ (module.efficiency * 100).toFixed(0) }}%
          </span>
        </div>
      </div>
      <div v-else class="no-modules">
        暂无管理模块
      </div>
    </div>

    <div class="all-players">
      <h4>所有玩家</h4>
      <div class="players-list">
        <div
          v-for="player in playersList"
          :key="player.id"
          :class="['player-item', { me: player.id === gameStore.playerId, afk: player.isAFK }]"
        >
          <div class="player-dot" :class="{ online: player.isConnected }"></div>
          <span class="player-name">{{ player.name }}</span>
          <span v-if="player.id === gameState?.hostId" class="host-icon">👑</span>
          <span v-if="player.isAFK" class="afk-badge">挂机</span>
        </div>
      </div>
    </div>

    <div class="population-stats">
      <h4>人口统计</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ aliveCount }}</span>
          <span class="stat-label">存活</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ workingCount }}</span>
          <span class="stat-label">工作中</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ avgHealth.toFixed(0) }}</span>
          <span class="stat-label">平均健康</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ avgMorale.toFixed(0) }}</span>
          <span class="stat-label">平均士气</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/game';
import type { ShipModule } from '@deep-colony/shared';

const gameStore = useGameStore();

const gameState = computed(() => gameStore.gameState);
const currentPlayer = computed(() => gameStore.currentPlayer);
const myModules = computed(() => gameStore.myModules || []);
const isHost = computed(() => gameState.value?.hostId === gameStore.playerId);

const playersList = computed(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.players);
});

const colonists = computed(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.colonists);
});

const aliveCount = computed(() => {
  return colonists.value.filter(c => c.health > 0).length;
});

const workingCount = computed(() => {
  return colonists.value.filter(c => c.health > 0 && c.assignedModule && !c.isMutineer).length;
});

const avgHealth = computed(() => {
  const alive = colonists.value.filter(c => c.health > 0);
  if (alive.length === 0) return 0;
  return alive.reduce((sum, c) => sum + c.health, 0) / alive.length;
});

const avgMorale = computed(() => {
  const alive = colonists.value.filter(c => c.health > 0);
  if (alive.length === 0) return 0;
  return alive.reduce((sum, c) => sum + c.morale, 0) / alive.length;
});

function getStatusClass(module: ShipModule): string {
  if (module.efficiency >= 0.8) return 'good';
  if (module.efficiency >= 0.5) return 'warn';
  return 'bad';
}
</script>

<style scoped>
.player-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
}

.player-panel h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.current-player {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 14px;
}

.player-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.player-role {
  font-size: 12px;
  color: var(--text-muted);
}

.my-modules, .all-players, .population-stats {
  margin-bottom: 14px;
}

.my-modules h4, .all-players h4, .population-stats h4 {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.modules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-module {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
}

.module-name {
  color: var(--text-primary);
}

.module-status {
  font-weight: 600;
}

.module-status.good {
  color: var(--accent-green);
}

.module-status.warn {
  color: var(--accent-yellow);
}

.module-status.bad {
  color: var(--accent-red);
}

.no-modules {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 10px;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
}

.player-item.me {
  border: 1px solid var(--accent-cyan);
}

.player-item.afk {
  opacity: 0.6;
}

.player-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.player-dot.online {
  background: var(--accent-green);
}

.player-item .player-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.host-icon {
  font-size: 14px;
}

.afk-badge {
  padding: 2px 6px;
  background: rgba(255, 136, 0, 0.2);
  color: var(--accent-orange);
  border-radius: 4px;
  font-size: 10px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-cyan);
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
