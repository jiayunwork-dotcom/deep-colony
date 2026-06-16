<template>
  <div class="game-container">
    <div class="game-header">
      <div class="header-left">
        <button class="btn-back" @click="goBack">← 返回</button>
        <span class="turn-info">第 {{ gameState?.turn || 0 }} 回合</span>
      </div>
      <div class="header-center">
        <h1>深空殖民地</h1>
      </div>
      <div class="header-right">
        <button v-if="isHost" class="btn btn-next-turn" @click="nextTurn">
          下一回合 →
        </button>
      </div>
    </div>

    <div v-if="gameState" class="game-main">
      <div class="left-sidebar">
        <ResourcePanel />
        <StarMapPanel />
      </div>

      <div class="center-panel">
        <div class="modules-section">
          <h2>飞船模块</h2>
          <div class="modules-grid">
            <ModuleCard
              v-for="module in modulesList"
              :key="module.id"
              :module="module"
              :is-manageable="canManageModule(module.id)"
              @power-change="handlePowerChange"
            />
          </div>
        </div>

        <div class="events-section">
          <h2>事件日志</h2>
          <div class="event-log">
            <div
              v-for="(log, idx) in recentLogs"
              :key="idx"
              :class="['log-entry', log.type]"
            >
              <span class="log-turn">[{{ log.turn }}]</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="right-sidebar">
        <PlayerPanel />
        <TechPanel />
        <ChatPanel />
      </div>
    </div>

    <div v-else class="loading">
      加载中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import ResourcePanel from '@/components/ResourcePanel.vue';
import ModuleCard from '@/components/ModuleCard.vue';
import StarMapPanel from '@/components/StarMapPanel.vue';
import PlayerPanel from '@/components/PlayerPanel.vue';
import TechPanel from '@/components/TechPanel.vue';
import ChatPanel from '@/components/ChatPanel.vue';
import type { ModuleType, PlayerAction } from '@deep-colony/shared';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();

const roomId = computed(() => route.params.roomId as string);
const gameState = computed(() => gameStore.gameState);

const isHost = computed(() => {
  return gameState.value?.hostId === gameStore.playerId;
});

const modulesList = computed(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.modules);
});

const recentLogs = computed(() => {
  if (!gameState.value) return [];
  return [...gameState.value.gameLog].reverse().slice(0, 20);
});

function canManageModule(moduleId: ModuleType): boolean {
  return gameStore.myModules?.some(m => m.id === moduleId) || false;
}

function handlePowerChange(moduleId: ModuleType, powerLevel: number) {
  const action: PlayerAction = {
    type: 'setPower',
    moduleId,
    powerLevel,
  };
  gameStore.sendAction(action);
}

async function nextTurn() {
  await gameStore.advanceTurn();
}

function goBack() {
  if (confirm('确定要离开游戏吗？')) {
    gameStore.disconnectWebSocket();
    router.push(`/room/${roomId.value}`);
  }
}

let refreshInterval: number | null = null;

onMounted(async () => {
  await gameStore.fetchRoomState(roomId.value);
  gameStore.connectWebSocket(roomId.value);

  refreshInterval = window.setInterval(() => {
    gameStore.fetchRoomState(roomId.value);
  }, 2000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  gameStore.disconnectWebSocket();
});
</script>

<style scoped>
.game-container {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px;
}

.header-center {
  flex: 1;
  text-align: center;
}

.header-center h1 {
  font-size: 22px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-back {
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
}

.btn-back:hover {
  color: var(--text-primary);
}

.turn-info {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent-cyan);
}

.btn-next-turn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
  color: white;
  border-radius: 8px;
  font-weight: 600;
}

.btn-next-turn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
}

.game-main {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.left-sidebar, .right-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.center-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.modules-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.modules-section h2 {
  font-size: 18px;
  margin-bottom: 14px;
  color: var(--text-primary);
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.events-section {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.events-section h2 {
  font-size: 18px;
  margin-bottom: 12px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.event-log {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-entry {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  border-left: 3px solid var(--text-muted);
}

.log-entry.info {
  border-left-color: var(--accent-blue);
}

.log-entry.warning {
  border-left-color: var(--accent-yellow);
}

.log-entry.danger {
  border-left-color: var(--accent-red);
}

.log-entry.success {
  border-left-color: var(--accent-green);
}

.log-turn {
  color: var(--text-muted);
  margin-right: 8px;
}

.log-message {
  color: var(--text-primary);
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 18px;
}
</style>
