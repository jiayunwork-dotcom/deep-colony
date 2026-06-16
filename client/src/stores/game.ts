import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  GameState,
  PlayerAction,
  RoomInfo,
  BatchPlayerAction,
  BatchActionResult,
} from '@deep-colony/shared';

export const useGameStore = defineStore('game', () => {
  const playerId = ref<string>(localStorage.getItem('playerId') || '');
  const playerName = ref<string>(localStorage.getItem('playerName') || '');
  const currentRoomId = ref<string>('');
  const gameState = ref<GameState | null>(null);
  const rooms = ref<RoomInfo[]>([]);
  const isConnected = ref(false);
  const ws = ref<WebSocket | null>(null);
  const chatMessages = ref<{ playerId: string; message: string; timestamp: number }[]>([]);

  const notifications = ref<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }[]>([]);

  const pendingBatchAction = ref<BatchPlayerAction | null>(null);
  const lastBatchResult = ref<BatchActionResult | null>(null);
  const batchActionCallback = ref<((result: BatchActionResult) => void) | null>(null);

  const currentPlayer = computed(() => {
    if (!gameState.value || !playerId.value) return null;
    return gameState.value.players[playerId.value] || null;
  });

  const myModules = computed(() => {
    if (!gameState.value || !currentPlayer.value) return [];
    return currentPlayer.value.assignedModules.map(id => gameState.value!.modules[id]);
  });

  function setPlayerInfo(id: string, name: string) {
    playerId.value = id;
    playerName.value = name;
    localStorage.setItem('playerId', id);
    localStorage.setItem('playerName', name);
  }

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      rooms.value = data.rooms || [];
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    }
  }

  async function createRoom(name: string) {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name, playerId: playerId.value || undefined }),
    });
    const data = await res.json();
    if (data.roomId && data.playerId) {
      setPlayerInfo(data.playerId, name);
      currentRoomId.value = data.roomId;
      gameState.value = data.state;
      return data.roomId;
    }
    throw new Error(data.error || '创建房间失败');
  }

  async function joinRoom(roomId: string, name: string) {
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name, playerId: playerId.value || undefined }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setPlayerInfo(data.playerId, name);
    currentRoomId.value = roomId;
    gameState.value = data.state;
    return data.playerId;
  }

  async function fetchRoomState(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}`);
    const data = await res.json();
    if (data.state) {
      gameState.value = data.state;
      return data.state;
    }
    return null;
  }

  async function startGame(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerId.value }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    gameState.value = data.state;
    return data.state;
  }

  async function sendAction(action: PlayerAction) {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      const res = await fetch(`/api/rooms/${currentRoomId.value}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId.value, action }),
      });
      const data = await res.json();
      if (data.state) {
        gameState.value = data.state;
      }
      return data;
    }

    ws.value.send(JSON.stringify({
      type: 'action',
      action,
    }));
  }

  function pushNotification(type: 'success' | 'error' | 'warning' | 'info', message: string) {
    const id = Math.random().toString(36).slice(2, 10);
    notifications.value.push({ id, type, message });
    setTimeout(() => {
      const idx = notifications.value.findIndex(n => n.id === id);
      if (idx > -1) notifications.value.splice(idx, 1);
    }, 5000);
  }

  function dismissNotification(id: string) {
    const idx = notifications.value.findIndex(n => n.id === id);
    if (idx > -1) notifications.value.splice(idx, 1);
  }

  async function sendBatchAction(
    action: BatchPlayerAction,
    callback?: (result: BatchActionResult) => void
  ): Promise<BatchActionResult | null> {
    pendingBatchAction.value = action;
    if (callback) batchActionCallback.value = callback;

    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      try {
        const res = await fetch(`/api/rooms/${currentRoomId.value}/batchAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: playerId.value, action }),
        });
        const data = await res.json();
        if (data.state) {
          gameState.value = data.state;
        }
        if (data.result) {
          lastBatchResult.value = data.result;
          if (batchActionCallback.value) {
            batchActionCallback.value(data.result);
            batchActionCallback.value = null;
          }
          return data.result;
        }
      } catch (e) {
        console.error('Batch action failed:', e);
        pushNotification('error', '批量操作请求失败');
      } finally {
        pendingBatchAction.value = null;
      }
      return null;
    }

    ws.value.send(JSON.stringify({
      type: 'batchAction',
      action,
    }));

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingBatchAction.value = null;
        resolve(null);
      }, 10000);

      const origCallback = batchActionCallback.value;
      batchActionCallback.value = (result) => {
        clearTimeout(timeout);
        pendingBatchAction.value = null;
        if (origCallback) origCallback(result);
        resolve(result);
        batchActionCallback.value = null;
      };
    });
  }

  async function advanceTurn() {
    const res = await fetch(`/api/rooms/${currentRoomId.value}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerId.value }),
    });
    const data = await res.json();
    if (data.state) {
      gameState.value = data.state;
    }
    return data;
  }

  function connectWebSocket(roomId: string) {
    if (ws.value) {
      ws.value.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${playerId.value}`;

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      isConnected.value = true;
      console.log('WebSocket connected');
    };

    ws.value.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.value.onclose = () => {
      isConnected.value = false;
      console.log('WebSocket disconnected');
    };

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  function handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'stateUpdated':
      case 'gameStarted':
      case 'turnAdvanced':
      case 'playerJoined':
      case 'playerLeft':
        if (data.state) {
          gameState.value = data.state;
        }
        break;
      case 'batchActionResult':
        if (data.result) {
          lastBatchResult.value = data.result;
          if (batchActionCallback.value) {
            batchActionCallback.value(data.result);
            batchActionCallback.value = null;
          }
        }
        break;
      case 'chat':
        chatMessages.value.push({
          playerId: data.playerId,
          message: data.message,
          timestamp: data.timestamp,
        });
        if (chatMessages.value.length > 50) {
          chatMessages.value.shift();
        }
        break;
    }
  }

  function sendChat(message: string) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        type: 'chat',
        message,
      }));
      chatMessages.value.push({
        playerId: playerId.value,
        message,
        timestamp: Date.now(),
      });
    }
  }

  function disconnectWebSocket() {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
  }

  function $reset() {
    gameState.value = null;
    currentRoomId.value = '';
    chatMessages.value = [];
    disconnectWebSocket();
  }

  return {
    playerId,
    playerName,
    currentRoomId,
    gameState,
    rooms,
    isConnected,
    chatMessages,
    notifications,
    pendingBatchAction,
    lastBatchResult,
    currentPlayer,
    myModules,
    setPlayerInfo,
    fetchRooms,
    createRoom,
    joinRoom,
    fetchRoomState,
    startGame,
    sendAction,
    sendBatchAction,
    advanceTurn,
    connectWebSocket,
    sendChat,
    disconnectWebSocket,
    pushNotification,
    dismissNotification,
    $reset,
  };
});
