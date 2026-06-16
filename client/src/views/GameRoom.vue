<template>
  <div class="room-container">
    <div class="room-header">
      <button class="btn-back" @click="goBack">← 返回</button>
      <h1>房间 {{ roomId }}</h1>
      <div class="room-code" @click="copyRoomCode">
        房间号: <span class="code">{{ roomId }}</span>
        <span class="copy-hint">点击复制</span>
      </div>
    </div>

    <div v-if="gameState" class="room-content">
      <div class="players-panel">
        <h2>玩家列表 ({{ Object.keys(gameState.players).length }}/{{ gameState.maxPlayers }})</h2>
        <div class="player-list">
          <div
            v-for="player in playersList"
            :key="player.id"
            :class="['player-card', { host: player.id === gameState.hostId, me: player.id === gameStore.playerId }]"
          >
            <div class="player-info">
              <span class="player-name">{{ player.name }}</span>
              <span v-if="player.id === gameState.hostId" class="host-badge">房主</span>
              <span v-if="player.id === gameStore.playerId" class="me-badge">我</span>
            </div>
            <div class="player-status">
              <span :class="['status-dot', { online: player.isConnected }]"></span>
              <span class="status-text">{{ player.isConnected ? '在线' : '离线' }}</span>
            </div>
            <div v-if="player.assignedModules.length > 0" class="player-modules">
              管理模块: {{ player.assignedModules.map(m => moduleNames[m]).join(', ') }}
            </div>
          </div>
        </div>
      </div>

      <div class="info-panel">
        <div v-if="gameState.phase === 'waiting'" class="waiting-info">
          <h3>等待游戏开始</h3>
          <p>至少需要 4 名玩家才能开始游戏</p>
          <div v-if="isHost" class="host-actions">
            <button
              class="btn btn-start"
              @click="handleStartGame"
              :disabled="playersList.length < 4"
            >
              开始游戏
            </button>
            <p v-if="playersList.length < 4" class="hint">
              还需要 {{ 4 - playersList.length }} 名玩家
            </p>
          </div>
          <div v-else class="spectator-info">
            <p>等待房主开始游戏...</p>
          </div>
        </div>

        <div v-if="gameState.phase === 'playing'" class="game-info">
          <h3>游戏进行中</h3>
          <p>当前回合: 第 {{ gameState.turn }} 回合</p>
          <button class="btn btn-primary" @click="enterGame">进入游戏</button>
        </div>

        <div v-if="gameState.phase === 'ended'" class="end-info">
          <h3 :class="{ winner: gameState.winner }">
            {{ gameState.winner ? '🎉 胜利！' : '💀 失败' }}
          </h3>
          <p v-if="gameState.finalScore">最终得分: {{ gameState.finalScore }}</p>
        </div>

        <div class="modules-preview">
          <h3>飞船模块</h3>
          <div class="modules-grid">
            <div v-for="module in modulesList" :key="module.id" class="module-mini">
              <span class="module-name">{{ module.name }}</span>
              <span class="module-power">⚡ {{ module.powerLevel }}级</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading">
      加载中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import { MODULE_NAMES } from '@deep-colony/shared';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();

const roomId = computed(() => route.params.roomId as string);
const gameState = computed(() => gameStore.gameState);

const moduleNames = MODULE_NAMES;

const playersList = computed(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.players);
});

const modulesList = computed(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.modules);
});

const isHost = computed(() => {
  return gameState.value?.hostId === gameStore.playerId;
});

let refreshInterval: number | null = null;

onMounted(async () => {
  await loadRoomState();
  gameStore.connectWebSocket(roomId.value);
  
  refreshInterval = window.setInterval(() => {
    loadRoomState();
  }, 3000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function loadRoomState() {
  try {
    await gameStore.fetchRoomState(roomId.value);
  } catch (e) {
    console.error('Failed to load room state:', e);
  }
}

function goBack() {
  gameStore.disconnectWebSocket();
  router.push('/');
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomId.value);
  alert('房间号已复制到剪贴板: ' + roomId.value);
}

async function handleStartGame() {
  try {
    await gameStore.startGame(roomId.value);
  } catch (e: any) {
    alert(e.message || '开始游戏失败');
  }
}

function enterGame() {
  router.push(`/game/${roomId.value}`);
}
</script>

<style scoped>
.room-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  padding: 20px;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto 30px;
}

.btn-back {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
}

.btn-back:hover {
  color: var(--text-primary);
}

.room-header h1 {
  flex: 1;
  font-size: 28px;
  color: var(--text-primary);
}

.room-code {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.room-code:hover {
  border-color: var(--accent-blue);
}

.room-code .code {
  color: var(--accent-cyan);
  font-weight: 600;
  letter-spacing: 2px;
  margin: 0 4px;
}

.room-code .copy-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.room-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 30px;
}

.players-panel, .info-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
}

.players-panel h2, .info-panel h3 {
  font-size: 20px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.player-card {
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s;
}

.player-card.host {
  border-color: var(--accent-yellow);
}

.player-card.me {
  border-color: var(--accent-cyan);
  background: rgba(0, 212, 255, 0.1);
}

.player-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.player-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.host-badge {
  padding: 2px 8px;
  background: rgba(255, 204, 0, 0.2);
  color: var(--accent-yellow);
  border-radius: 4px;
  font-size: 12px;
}

.me-badge {
  padding: 2px 8px;
  background: rgba(0, 212, 255, 0.2);
  color: var(--accent-cyan);
  border-radius: 4px;
  font-size: 12px;
}

.player-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot.online {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.player-modules {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.waiting-info, .game-info, .end-info {
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.waiting-info p, .game-info p, .end-info p {
  color: var(--text-secondary);
  margin: 10px 0;
}

.host-actions {
  margin-top: 20px;
}

.btn-start {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
  color: white;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.3);
}

.hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 10px;
}

.spectator-info p {
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-primary {
  width: 100%;
  padding: 12px 24px;
  margin-top: 16px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  color: white;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.end-info h3.winner {
  color: var(--accent-green);
}

.modules-preview h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.module-mini {
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.module-name {
  color: var(--text-primary);
}

.module-power {
  color: var(--accent-yellow);
  font-weight: 500;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}
</style>
