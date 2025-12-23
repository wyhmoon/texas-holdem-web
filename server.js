import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = 3001;
const server = createServer();
const wss = new WebSocketServer({ server });

// 游戏房间管理
const rooms = new Map();

// 广播消息到房间内所有客户端
function broadcastToRoom(roomId, message, excludeClient = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.forEach(client => {
    if (client !== excludeClient && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// 向特定客户端发送消息
function sendToClient(client, message) {
  if (client && client.readyState === 1) {
    client.send(JSON.stringify(message));
  }
}

wss.on('connection', (ws) => {
  console.log('新客户端连接');
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'create-room': {
          // 创建房间
          const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
          currentRoom = roomId;
          playerId = 0; // 创建者是玩家0（人类玩家）
          
          rooms.set(roomId, {
            id: roomId,
            host: ws,
            clients: new Map([[ws, { id: playerId, name: message.playerName || '玩家1' }]]),
            gameState: null,
            playerCount: 1
          });
          
          // 向房主发送房间创建成功消息和玩家列表
          ws.send(JSON.stringify({
            type: 'room-created',
            roomId,
            playerId,
            players: [{ id: playerId, name: message.playerName || '玩家1' }]
          }));
          
          console.log(`房间创建: ${roomId}`);
          break;
        }
        
        case 'join-room': {
          // 加入房间
          const { roomId, playerName } = message;
          const room = rooms.get(roomId);
          
          if (!room) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '房间不存在'
            }));
            break;
          }
          
          if (room.playerCount >= 6) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '房间已满'
            }));
            break;
          }
          
          currentRoom = roomId;
          playerId = room.playerCount;
          room.clients.set(ws, { id: playerId, name: playerName || `玩家${playerId + 1}` });
          room.playerCount++;
          
          // 向新加入的玩家发送房间内所有玩家的信息
          const allPlayers = Array.from(room.clients.entries()).map(([client, playerData]) => ({
            id: playerData.id,
            name: playerData.name
          }));
          
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId,
            playerId,
            players: allPlayers // 发送所有玩家信息
          }));
          
          // 向房间内其他玩家发送玩家加入通知
          const updatedPlayers = Array.from(room.clients.entries()).map(([client, playerData]) => ({
            id: playerData.id,
            name: playerData.name
          }));
          
          broadcastToRoom(roomId, {
            type: 'player-joined',
            playerId,
            playerName: playerName || `玩家${playerId + 1}`,
            players: updatedPlayers, // 发送更新后的所有玩家信息
            totalPlayers: room.playerCount
          }, ws);
          
          console.log(`玩家${playerId}加入房间${roomId}`);
          break;
        }
        
        case 'start-game': {
          // 开始游戏
          if (!currentRoom) break;
          
          // 创建初始游戏状态
          const room = rooms.get(currentRoom);
          if (!room) break;
          
          // 获取房间内的所有玩家
          const clientsArray = Array.from(room.clients.entries());
          const players = clientsArray.map(([client, clientData], index) => ({
            id: clientData.id,
            name: clientData.name,
            type: index === 0 ? 'human' : 'ai', // 第一个玩家是人类玩家
            chips: 1000, // 初始筹码
            cards: [], // 初始没有牌
            currentBet: 0,
            totalBet: 0,
            isFolded: false,
            isAllIn: false,
            isDealer: false,
            isSmallBlind: false,
            isBigBlind: false,
            isActive: true
          }));
          
          // 创建初始游戏状态
          const gameState = {
            players,
            communityCards: [],
            pot: 0,
            currentBet: 0,
            phase: 'preflop', // 使用正确的阶段名称
            currentPlayerIndex: 0,
            dealerIndex: 0,
            smallBlindAmount: 10,
            bigBlindAmount: 20,
            deck: [], // 实际游戏中会初始化牌堆
            winners: [],
            message: '游戏开始',
            roundComplete: false,
            minRaise: 20, // 最小加注额
            lastRaiseAmount: 0,
            actionCount: 0
          };
          
          // 更新房间的游戏状态
          room.gameState = gameState;
          
          broadcastToRoom(currentRoom, {
            type: 'game-started',
            gameState
          });
          break;
        }
      }
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  });

  ws.on('close', () => {
    console.log('客户端断开连接');
    
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        const clientData = room.clients.get(ws);
        room.clients.delete(ws);
        
        // 构建更新后的玩家列表
        const updatedPlayers = Array.from(room.clients.entries()).map(([client, playerData]) => ({
          id: playerData.id,
          name: playerData.name
        }));
        
        // 通知其他玩家
        broadcastToRoom(currentRoom, {
          type: 'player-left',
          playerId: clientData ? clientData.id : null,
          players: updatedPlayers // 发送更新后的玩家列表
        });
        
        // 如果房间空了，删除房间
        if (room.clients.size === 0) {
          rooms.delete(currentRoom);
          console.log(`房间${currentRoom}已删除`);
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebSocket服务器运行在 ws://0.0.0.0:${PORT}`);
  console.log(`局域网其他设备可通过本机IP访问`);
});
