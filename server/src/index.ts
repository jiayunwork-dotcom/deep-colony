import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import {
  createRoom,
  joinRoom,
  startGame,
  getGameState,
  handlePlayerAction,
  advanceTurn,
  leaveRoom,
  listRooms,
  getPlayerRoom,
  handleBatchPlayerAction,
} from './room/roomManager';
import type { PlayerAction, BatchPlayerAction, ModuleType, ShipModule } from '@deep-colony/shared';

const PORT = parseInt(process.env.PORT || '3001');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: CORS_ORIGIN,
  credentials: true,
});

fastify.register(websocketPlugin);

interface WsConnection {
  roomId: string;
  playerId: string;
  socket: any;
}

const connections = new Map<string, WsConnection[]>();

function broadcastToRoom(roomId: string, message: any, excludePlayerId?: string) {
  const roomConnections = connections.get(roomId) || [];
  for (const conn of roomConnections) {
    if (excludePlayerId && conn.playerId === excludePlayerId) continue;
    if (conn.socket.readyState === 1) {
      conn.socket.send(JSON.stringify(message));
    }
  }
}

fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', uptime: process.uptime() };
});

fastify.get('/api/rooms', async (request, reply) => {
  const rooms = await listRooms();
  return { rooms };
});

fastify.post('/api/rooms', async (request, reply) => {
  const { playerName, playerId } = request.body as { playerName: string; playerId?: string };

  if (!playerName || playerName.trim().length === 0) {
    reply.code(400);
    return { error: '玩家名称不能为空' };
  }

  const result = await createRoom(playerName.trim(), playerId);
  return result;
});

fastify.post('/api/rooms/:roomId/join', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const { playerName, playerId } = request.body as { playerName: string; playerId?: string };

  if (!playerName || playerName.trim().length === 0) {
    reply.code(400);
    return { error: '玩家名称不能为空' };
  }

  const result = await joinRoom(roomId.toUpperCase(), playerName.trim(), playerId);
  if ('error' in result) {
    reply.code(400);
    return result;
  }

  const state = result.state;
  broadcastToRoom(roomId.toUpperCase(), {
    type: 'playerJoined',
    playerId: result.playerId,
    playerName: playerName.trim(),
    state,
  });

  return result;
});

fastify.post('/api/rooms/:roomId/start', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const { playerId } = request.body as { playerId: string };

  const result = await startGame(roomId.toUpperCase(), playerId);
  if ('error' in result) {
    reply.code(400);
    return result;
  }

  broadcastToRoom(roomId.toUpperCase(), {
    type: 'gameStarted',
    state: result,
  });

  return { success: true, state: result };
});

fastify.get('/api/rooms/:roomId', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const state = await getGameState(roomId.toUpperCase());

  if (!state) {
    reply.code(404);
    return { error: '房间不存在' };
  }

  return { state };
});

fastify.post('/api/rooms/:roomId/action', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const { playerId, action } = request.body as { playerId: string; action: PlayerAction };

  const result = await handlePlayerAction(roomId.toUpperCase(), playerId, action);
  if (!result.success) {
    reply.code(400);
    return { error: result.error };
  }

  broadcastToRoom(roomId.toUpperCase(), {
    type: 'stateUpdated',
    state: result.state,
  });

  return { success: true, state: result.state };
});

fastify.post('/api/rooms/:roomId/batchAction', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const { playerId, action } = request.body as { playerId: string; action: BatchPlayerAction };

  const result = await handleBatchPlayerAction(roomId.toUpperCase(), playerId, action);
  if (!result.success) {
    reply.code(400);
    return { error: result.error };
  }

  broadcastToRoom(roomId.toUpperCase(), {
    type: 'stateUpdated',
    state: result.state,
  });

  return { success: true, state: result.state, result: result.result };
});

fastify.post('/api/rooms/:roomId/turn', async (request, reply) => {
  const { roomId } = request.params as { roomId: string };
  const { playerId } = request.body as { playerId: string };

  const state = await getGameState(roomId.toUpperCase());
  if (!state) {
    reply.code(404);
    return { error: '房间不存在' };
  }

  if (state.hostId !== playerId) {
    reply.code(403);
    return { error: '只有房主可以推进回合' };
  }

  const { state: newState, shiftResult } = await advanceTurn(roomId.toUpperCase());
  if (newState) {
    broadcastToRoom(roomId.toUpperCase(), {
      type: 'turnAdvanced',
      state: newState,
    });

    if (shiftResult.shiftUpdates.length > 0) {
      broadcastToRoom(roomId.toUpperCase(), {
        type: 'turnShiftUpdate',
        updates: shiftResult.shiftUpdates,
      });
    }

    if (shiftResult.statusUpdates.length > 0) {
      broadcastToRoom(roomId.toUpperCase(), {
        type: 'colonistStatusUpdate',
        updates: shiftResult.statusUpdates,
      });
    }
  }

  return { success: true, state: newState, shiftResult };
});

fastify.register(async (fastify) => {
  fastify.get('/ws/:roomId/:playerId', { websocket: true }, (connection, req) => {
    const { roomId, playerId } = req.params as { roomId: string; playerId: string };
    const upperRoomId = roomId.toUpperCase();

    fastify.log.info(`WebSocket connected: ${playerId} in room ${upperRoomId}`);

    if (!connections.has(upperRoomId)) {
      connections.set(upperRoomId, []);
    }

    const roomConns = connections.get(upperRoomId)!;
    const connEntry = { roomId: upperRoomId, playerId, socket: connection.socket };
    roomConns.push(connEntry);

    connection.socket.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        fastify.log.info(`Received message from ${playerId}:`, data.type);

        switch (data.type) {
          case 'ping':
            connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          case 'action':
            const result = await handlePlayerAction(upperRoomId, playerId, data.action);
            if (result.success && result.state) {
              broadcastToRoom(upperRoomId, {
                type: 'stateUpdated',
                state: result.state,
              });

              if (data.action.type === 'changeShiftMode' && data.action.moduleId) {
                const moduleId = data.action.moduleId as string;
                const modules = result.state.modules as Record<string, ShipModule>;
                const module = modules[moduleId];
                if (module) {
                  broadcastToRoom(upperRoomId, {
                    type: 'turnShiftUpdate',
                    updates: [{
                      moduleId: data.action.moduleId,
                      shiftConfig: { ...module.shiftConfig },
                      affectedColonists: module.crewAssigned,
                    }],
                  });
                }
              }
            }
            break;
          case 'batchAction':
            const batchResult = await handleBatchPlayerAction(upperRoomId, playerId, data.action);
            if (batchResult.success && batchResult.state) {
              broadcastToRoom(upperRoomId, {
                type: 'stateUpdated',
                state: batchResult.state,
              });
              connection.socket.send(JSON.stringify({
                type: 'batchActionResult',
                result: batchResult.result,
              }));
            }
            break;
          case 'chat':
            broadcastToRoom(upperRoomId, {
              type: 'chat',
              playerId,
              message: data.message,
              timestamp: Date.now(),
            }, playerId);
            break;
        }
      } catch (err) {
        fastify.log.error({ err }, 'WebSocket message error');
      }
    });

    connection.socket.on('close', async () => {
      fastify.log.info(`WebSocket disconnected: ${playerId}`);

      const roomConns = connections.get(upperRoomId);
      if (roomConns) {
        const idx = roomConns.findIndex(c => c.playerId === playerId);
        if (idx > -1) roomConns.splice(idx, 1);
        if (roomConns.length === 0) {
          connections.delete(upperRoomId);
        }
      }

      await leaveRoom(playerId);
      const state = await getGameState(upperRoomId);
      if (state) {
        broadcastToRoom(upperRoomId, {
          type: 'playerLeft',
          playerId,
          state,
        });
      }
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Deep Colony server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
