import type { GameState, Player, PlayerAction, ModuleType, ShiftProcessingResult } from '@deep-colony/shared';
import {
  createInitialGameState,
  processTurn,
  applyPlayerAction,
  autoAssignCrew,
  updateModuleEfficiencies,
  updateModuleEfficienciesWithSkills,
  applyBatchPlayerAction,
} from '../game';
import type { BatchPlayerAction, BatchActionResult } from '@deep-colony/shared';
import { v4 as uuidv4 } from 'uuid';

const GAME_STATE_PREFIX = 'game:state:';
const PLAYER_SESSIONS_PREFIX = 'game:sessions:';

const memoryStore = new Map<string, string>();

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(hostName: string, hostId?: string): Promise<{ roomId: string; playerId: string; state: GameState }> {
  const roomId = generateRoomId();
  const playerId = hostId || uuidv4();

  const state = createInitialGameState(roomId);
  state.hostId = playerId;

  const player: Player = {
    id: playerId,
    name: hostName,
    assignedModules: [],
    isConnected: true,
    lastActionTurn: 0,
    isAFK: false,
    afkTurns: 0,
  };

  state.players[playerId] = player;

  await saveGameState(roomId, state);
  await setPlayerSession(playerId, roomId);

  return { roomId, playerId, state };
}

export async function joinRoom(roomId: string, playerName: string, playerId?: string): Promise<{ playerId: string; state: GameState } | { error: string }> {
  const state = await getGameState(roomId);
  if (!state) {
    return { error: '房间不存在' };
  }

  if (state.phase !== 'waiting') {
    return { error: '游戏已经开始，无法加入' };
  }

  const playerCount = Object.keys(state.players).length;
  if (playerCount >= state.maxPlayers) {
    return { error: '房间已满' };
  }

  const newPlayerId = playerId || uuidv4();

  const player: Player = {
    id: newPlayerId,
    name: playerName,
    assignedModules: [],
    isConnected: true,
    lastActionTurn: 0,
    isAFK: false,
    afkTurns: 0,
  };

  state.players[newPlayerId] = player;

  await saveGameState(roomId, state);
  await setPlayerSession(newPlayerId, roomId);

  return { playerId: newPlayerId, state };
}

export async function startGame(roomId: string, playerId: string): Promise<GameState | { error: string }> {
  const state = await getGameState(roomId);
  if (!state) return { error: '房间不存在' };

  if (state.hostId !== playerId) {
    return { error: '只有房主可以开始游戏' };
  }

  const playerCount = Object.keys(state.players).length;
  if (playerCount < 1) {
    return { error: '至少需要1名玩家才能开始游戏' };
  }

  assignModulesToPlayers(state);

  autoAssignCrew(state);
  updateModuleEfficienciesWithSkills(state);

  state.phase = 'playing';
  state.turn = 0;

  await saveGameState(roomId, state);

  return state;
}

function assignModulesToPlayers(state: GameState): void {
  const allModules: ModuleType[] = [
    'mainEngine', 'lifeSupport', 'waterCycle', 'farm',
    'quarters', 'factory', 'medicalBay', 'laboratory',
    'defense', 'communication'
  ];

  const playerIds = Object.keys(state.players);
  const numPlayers = playerIds.length;

  const shuffled = [...allModules].sort(() => Math.random() - 0.5);
  const modulesPerPlayer = Math.floor(shuffled.length / numPlayers);
  const extraModules = shuffled.length % numPlayers;

  let moduleIndex = 0;
  for (let i = 0; i < numPlayers; i++) {
    const count = modulesPerPlayer + (i < extraModules ? 1 : 0);
    state.players[playerIds[i]].assignedModules = shuffled.slice(moduleIndex, moduleIndex + count);
    moduleIndex += count;
  }
}

export async function leaveRoom(playerId: string): Promise<void> {
  const roomId = await getPlayerRoom(playerId);
  if (!roomId) return;

  const state = await getGameState(roomId);
  if (!state) return;

  if (state.players[playerId]) {
    state.players[playerId].isConnected = false;
    await saveGameState(roomId, state);
  }

  await clearPlayerSession(playerId);
}

export async function getGameState(roomId: string): Promise<GameState | null> {
  const data = memoryStore.get(GAME_STATE_PREFIX + roomId);
  if (!data) return null;
  return JSON.parse(data);
}

export async function saveGameState(roomId: string, state: GameState): Promise<void> {
  memoryStore.set(GAME_STATE_PREFIX + roomId, JSON.stringify(state));
}

export async function setPlayerSession(playerId: string, roomId: string): Promise<void> {
  memoryStore.set(PLAYER_SESSIONS_PREFIX + playerId, roomId);
}

export async function getPlayerRoom(playerId: string): Promise<string | null> {
  return memoryStore.get(PLAYER_SESSIONS_PREFIX + playerId) || null;
}

export async function clearPlayerSession(playerId: string): Promise<void> {
  memoryStore.delete(PLAYER_SESSIONS_PREFIX + playerId);
}

export async function handlePlayerAction(
  roomId: string,
  playerId: string,
  action: PlayerAction
): Promise<{ success: boolean; state: GameState | null; error?: string }> {
  const state = await getGameState(roomId);
  if (!state) return { success: false, state: null, error: '房间不存在' };

  const isHost = state.hostId === playerId;
  const hostAllowedActions: PlayerAction['type'][] = [
    'changeShiftMode',
    'reassignShiftGroup',
    'assignCrew',
    'unassignCrew',
    'setPower',
  ];

  if (state.phase !== 'playing') {
    if (state.phase === 'waiting' && isHost && hostAllowedActions.includes(action.type)) {
      // 房主在 waiting 阶段可以执行配置操作
    } else {
      return { success: false, state: null, error: '游戏未进行中' };
    }
  }

  const success = applyPlayerAction(state, playerId, action);
  if (!success) {
    return { success: false, state: null, error: '操作失败' };
  }

  updateModuleEfficienciesWithSkills(state);
  await saveGameState(roomId, state);

  return { success: true, state };
}

export async function advanceTurn(roomId: string): Promise<{ state: GameState | null; shiftResult: ShiftProcessingResult }> {
  const state = await getGameState(roomId);
  if (!state) return { state: null, shiftResult: { shiftUpdates: [], statusUpdates: [] } };

  if (state.phase !== 'playing') return { state, shiftResult: { shiftUpdates: [], statusUpdates: [] } };

  const shiftResult = processTurn(state);
  await saveGameState(roomId, state);

  return { state, shiftResult };
}

export async function listRooms(): Promise<{ roomId: string; hostName: string; playerCount: number; maxPlayers: number; phase: string; turn: number }[]> {
  const rooms: { roomId: string; hostName: string; playerCount: number; maxPlayers: number; phase: string; turn: number }[] = [];

  for (const [key, data] of memoryStore.entries()) {
    if (key.startsWith(GAME_STATE_PREFIX)) {
      try {
        const state: GameState = JSON.parse(data);
        const hostPlayer = state.players[state.hostId];
        rooms.push({
          roomId: state.roomId,
          hostName: hostPlayer?.name || '未知',
          playerCount: Object.keys(state.players).length,
          maxPlayers: state.maxPlayers,
          phase: state.phase,
          turn: state.turn,
        });
      } catch {
        // skip invalid data
      }
    }
  }

  return rooms;
}

export async function handleBatchPlayerAction(
  roomId: string,
  playerId: string,
  action: BatchPlayerAction
): Promise<{ success: boolean; state: GameState | null; result?: BatchActionResult; error?: string }> {
  const state = await getGameState(roomId);
  if (!state) return { success: false, state: null, error: '房间不存在' };

  if (state.phase !== 'playing') {
    return { success: false, state: null, error: '游戏未进行中' };
  }

  const result = applyBatchPlayerAction(state, playerId, action);

  updateModuleEfficienciesWithSkills(state);
  await saveGameState(roomId, state);

  return { success: true, state, result };
}
