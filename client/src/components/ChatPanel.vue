<template>
  <div class="chat-panel">
    <h3>聊天</h3>
    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['chat-message', { mine: msg.playerId === gameStore.playerId }]"
      >
        <span class="chat-author">{{ getPlayerName(msg.playerId) }}:</span>
        <span class="chat-text">{{ msg.message }}</span>
      </div>
      <div v-if="messages.length === 0" class="no-messages">
        暂无消息
      </div>
    </div>
    <div class="chat-input">
      <input
        v-model="inputMessage"
        placeholder="输入消息..."
        @keyup.enter="sendMessage"
      />
      <button @click="sendMessage" :disabled="!inputMessage.trim()">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useGameStore } from '@/stores/game';

const gameStore = useGameStore();

const inputMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

const messages = computed(() => gameStore.chatMessages);

function getPlayerName(playerId: string): string {
  if (gameStore.gameState?.players[playerId]) {
    return gameStore.gameState.players[playerId].name;
  }
  return '未知玩家';
}

function sendMessage() {
  if (!inputMessage.value.trim()) return;
  gameStore.sendChat(inputMessage.value.trim());
  inputMessage.value = '';
}

watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}, { deep: true });
</script>

<style scoped>
.chat-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  max-height: 300px;
}

.chat-panel h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-bottom: 10px;
  min-height: 100px;
}

.chat-message {
  font-size: 13px;
  line-height: 1.4;
}

.chat-message.mine {
  text-align: right;
}

.chat-author {
  font-weight: 600;
  color: var(--accent-cyan);
  margin-right: 4px;
}

.chat-message.mine .chat-author {
  color: var(--accent-green);
}

.chat-text {
  color: var(--text-primary);
}

.no-messages {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 20px 0;
}

.chat-input {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.chat-input input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.chat-input input:focus {
  border-color: var(--accent-blue);
}

.chat-input button {
  padding: 8px 16px;
  background: var(--accent-blue);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.chat-input button:hover:not(:disabled) {
  background: #3a8eef;
}
</style>
