<template>
  <div class="home-container">
    <div class="hero-section">
      <h1 class="title">深空殖民地</h1>
      <p class="subtitle">Deep Colony - 多人回合制太空殖民策略游戏</p>
    </div>

    <div class="main-content">
      <div class="left-panel">
        <div class="panel">
          <h2>创建房间</h2>
          <div class="form-group">
            <label>你的名字</label>
            <input v-model="playerName" placeholder="输入你的名字" />
          </div>
          <button class="btn btn-primary" @click="handleCreateRoom" :disabled="!playerName.trim()">
            创建新房间
          </button>
        </div>

        <div class="panel">
          <h2>加入房间</h2>
          <div class="form-group">
            <label>房间号</label>
            <input v-model="roomCode" placeholder="输入房间号" maxlength="6" class="room-code-input" />
          </div>
          <div class="form-group">
            <label>你的名字</label>
            <input v-model="joinPlayerName" placeholder="输入你的名字" />
          </div>
          <button class="btn btn-secondary" @click="handleJoinRoom" :disabled="!roomCode.trim() || !joinPlayerName.trim()">
            加入房间
          </button>
        </div>
      </div>

      <div class="right-panel">
        <div class="panel">
          <div class="panel-header">
            <h2>房间列表</h2>
            <button class="btn-refresh" @click="loadRooms">刷新</button>
          </div>
          <div v-if="rooms.length === 0" class="empty-state">
            暂无可用房间，创建一个吧！
          </div>
          <div v-else class="room-list">
            <div
              v-for="room in rooms"
              :key="room.roomId"
              class="room-item"
              @click="selectRoom(room.roomId)"
            >
              <div class="room-info">
                <span class="room-id">{{ room.roomId }}</span>
                <span class="room-host">{{ room.hostName }} 的房间</span>
              </div>
              <div class="room-status">
                <span class="player-count">{{ room.playerCount }}/{{ room.maxPlayers }}</span>
                <span :class="['phase-badge', room.phase]">
                  {{ phaseText(room.phase) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMsg" class="error-toast" @click="errorMsg = ''">
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import { storeToRefs } from 'pinia';

const router = useRouter();
const gameStore = useGameStore();

const playerName = ref(gameStore.playerName || '');
const joinPlayerName = ref('');
const roomCode = ref('');
const errorMsg = ref('');

const { rooms } = storeToRefs(gameStore);

onMounted(() => {
  loadRooms();
});

function loadRooms() {
  gameStore.fetchRooms();
}

function phaseText(phase: string): string {
  switch (phase) {
    case 'waiting': return '等待中';
    case 'playing': return '进行中';
    case 'ended': return '已结束';
    default: return phase;
  }
}

async function handleCreateRoom() {
  try {
    const roomId = await gameStore.createRoom(playerName.value);
    router.push(`/room/${roomId}`);
  } catch (e: any) {
    showError(e.message || '创建房间失败');
  }
}

async function handleJoinRoom() {
  try {
    await gameStore.joinRoom(roomCode.value.toUpperCase(), joinPlayerName.value);
    router.push(`/room/${roomCode.value.toUpperCase()}`);
  } catch (e: any) {
    showError(e.message || '加入房间失败');
  }
}

function selectRoom(roomId: string) {
  roomCode.value = roomId;
  if (!joinPlayerName.value && playerName.value) {
    joinPlayerName.value = playerName.value;
  }
}

function showError(msg: string) {
  errorMsg.value = msg;
  setTimeout(() => {
    errorMsg.value = '';
  }, 3000);
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  padding: 40px 20px;
}

.hero-section {
  text-align: center;
  margin-bottom: 40px;
}

.title {
  font-size: 48px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 18px;
  color: var(--text-secondary);
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 30px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
}

.panel h2 {
  font-size: 20px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: var(--accent-blue);
}

.room-code-input {
  text-transform: uppercase;
  letter-spacing: 4px;
  font-size: 18px;
  text-align: center;
}

.btn {
  width: 100%;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--border-color);
}

.btn-refresh {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-refresh:hover {
  color: var(--text-primary);
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 0;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.room-item {
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-item:hover {
  border-color: var(--accent-blue);
  transform: translateX(4px);
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-id {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-cyan);
  letter-spacing: 2px;
}

.room-host {
  font-size: 13px;
  color: var(--text-secondary);
}

.room-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.player-count {
  font-size: 14px;
  color: var(--text-secondary);
}

.phase-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.phase-badge.waiting {
  background: rgba(0, 255, 136, 0.2);
  color: var(--accent-green);
}

.phase-badge.playing {
  background: rgba(74, 158, 255, 0.2);
  color: var(--accent-blue);
}

.phase-badge.ended {
  background: rgba(255, 68, 102, 0.2);
  color: var(--accent-red);
}

.error-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 20px;
  background: var(--accent-red);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
