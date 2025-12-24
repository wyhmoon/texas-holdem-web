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
  if (!room) {
    console.log('错误：尝试向不存在的房间广播消息', roomId);
    return;
  }

  console.log(`准备向房间 ${roomId} 广播消息，客户端数量: ${room.clients.size}, 排除客户端: ${!!excludeClient}`);
  
  let sentCount = 0;
  room.clients.forEach((clientData, clientWs) => {
    if (clientWs !== excludeClient) {
      // 检查WebSocket连接状态 - clientWs是WebSocket实例，clientData是{id, name}对象
      if (clientWs.readyState === 1) { // WebSocket.OPEN = 1
        try {
          clientWs.send(JSON.stringify(message));
          sentCount++;
          console.log(`消息已发送给客户端, 是否为房主: ${clientWs === room.host}, 状态: ${clientWs.readyState}`);
        } catch (error) {
          console.error('发送消息失败:', error);
        }
      } else {
        console.log(`跳过客户端, 状态检查失败 - readyState: ${clientWs.readyState}`);
      }
    } else {
      console.log(`跳过客户端 [${clientWs.constructor.name}] (被排除)`);
    }
  });
  
  console.log(`消息广播完成，共发送: ${sentCount} 条`);
}

// 向特定客户端发送消息
function sendToClient(client, message) {
  if (client && client.readyState === 1) {
    client.send(JSON.stringify(message));
  }
}

// 检查一轮是否结束
function checkRoundEnd(gameState) {
  if (!gameState || !gameState.players) return false;
  
  // 获取所有未弃牌且未全押的玩家
  const activePlayers = gameState.players.filter(player => 
    !player.isFolded && !player.isAllIn
  );
  
  if (activePlayers.length <= 1) {
    // 只剩一个玩家，游戏结束
    return true;
  }
  
  // 检查是否所有活跃玩家的下注金额都相等
  const activeBets = activePlayers.map(player => player.currentBet);
  const maxBet = Math.max(...activeBets);
  
  // 如果所有活跃玩家的下注都等于最高下注，就认为本轮结束
  const allMatchMaxBet = activePlayers.every(player => player.currentBet === maxBet);
  
  return allMatchMaxBet;
}

// 推进游戏阶段
function advanceGamePhase(room) {
  const gameState = room.gameState;
  if (!gameState) return;
  
  console.log(`推进游戏阶段: ${gameState.phase} -> ...`);
  
  switch (gameState.phase) {
    case 'preflop': // 底牌阶段结束
      // 发翻牌（3张公共牌）
      for (let i = 0; i < 3; i++) {
        if (gameState.deck.length > 0) {
          gameState.communityCards.push(gameState.deck.pop());
        }
      }
      gameState.phase = 'flop';
      console.log(`进入 flop 阶段，公共牌: ${JSON.stringify(gameState.communityCards)}`);
      // 重置所有玩家的当前下注
      resetPlayerBets(gameState);
      // 设置庄家位置的下一个玩家为当前行动玩家
      const nextActivePlayerFlop = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextActivePlayerFlop !== -1) {
        gameState.currentPlayerIndex = nextActivePlayerFlop;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
      }
      break;
      
    case 'flop': // 翻牌阶段
      // 发1张转牌
      if (gameState.deck.length > 0) {
        gameState.communityCards.push(gameState.deck.pop());
      }
      gameState.phase = 'turn';
      console.log(`进入 turn 阶段，公共牌: ${JSON.stringify(gameState.communityCards)}`);
      resetPlayerBets(gameState);
      const nextActivePlayerTurn = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextActivePlayerTurn !== -1) {
        gameState.currentPlayerIndex = nextActivePlayerTurn;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
      }
      break;
      
    case 'turn': // 转牌阶段
      // 发1张河牌
      if (gameState.deck.length > 0) {
        gameState.communityCards.push(gameState.deck.pop());
      }
      gameState.phase = 'river';
      console.log(`进入 river 阶段，公共牌: ${JSON.stringify(gameState.communityCards)}`);
      resetPlayerBets(gameState);
      const nextActivePlayerRiver = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextActivePlayerRiver !== -1) {
        gameState.currentPlayerIndex = nextActivePlayerRiver;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
      }
      break;
      
    case 'river': // 河牌阶段
      // 河牌圈结束后，进入摊牌阶段
      gameState.phase = 'showdown';
      console.log(`进入 showdown 阶段，所有公共牌: ${JSON.stringify(gameState.communityCards)}`);
      // 这里可以计算胜负，但现在简化处理
      break;
      
    case 'showdown':
      // 摊牌阶段，可以计算胜负，但现在简化处理
      console.log(`在 showdown 阶段，游戏状态: ${JSON.stringify(gameState.phase)}`);
      break;
      
    default:
      console.log(`未知游戏阶段: ${gameState.phase}`);
  }
}

// 重置玩家下注
function resetPlayerBets(gameState) {
  gameState.players.forEach(player => {
    if (!player.isFolded && !player.isAllIn) {
      player.currentBet = 0;
    }
  });
  gameState.currentBet = 0;
}

// 查找下一个活跃玩家
function findNextActivePlayer(gameState, startIndex) {
  let index = (startIndex + 1) % gameState.players.length;
  let attempts = 0;
  
  while (attempts < gameState.players.length) {
    const player = gameState.players[index];
    if (!player.isFolded && !player.isAllIn) {
      return index;
    }
    index = (index + 1) % gameState.players.length;
    attempts++;
  }
  
  // 如果没有找到活跃玩家，返回-1表示没有活跃玩家
  return -1;
}

// 处理AI玩家行动
function handleAIPlayerAction(room, playerIndex) {
  const gameState = room.gameState;
  if (!gameState) return;
  
  const aiPlayer = gameState.players[playerIndex];
  if (!aiPlayer || aiPlayer.type !== 'ai') return;
  
  // 确定AI行动 - 简化的AI逻辑
  let aiAction;
  if (gameState.currentBet > aiPlayer.currentBet) {
    // 如果有下注，AI可能选择跟注或弃牌
    aiAction = Math.random() > 0.3 ? 'call' : 'fold';
  } else {
    // 如果没有下注，AI可能选择过牌或加注
    aiAction = Math.random() > 0.5 ? 'check' : 'call'; // 简化处理，AI不会主动加注
  }
  
  console.log(`AI玩家 ${aiPlayer.name} (${aiPlayer.id}) 执行操作: ${aiAction}`);
  
  // 执行AI操作
  switch (aiAction) {
    case 'fold':
      aiPlayer.isFolded = true;
      break;
      
    case 'call':
      const callAmount = Math.max(gameState.currentBet - aiPlayer.currentBet, 0);
      if (callAmount > 0) {
        // 确保AI不会下注超过其筹码
        const actualCallAmount = Math.min(callAmount, aiPlayer.chips);
        aiPlayer.chips -= actualCallAmount;
        aiPlayer.currentBet += actualCallAmount;
        gameState.pot += actualCallAmount;
      }
      break;
      
    case 'check':
      // 检查操作，什么都不做
      break;
  }
  
  aiPlayer.lastAction = aiAction;
  
  // 检查本轮是否结束
  const roundEnded = checkRoundEnd(gameState);
  
  if (roundEnded) {
    // 本轮结束，进入下一阶段
    advanceGamePhase(room);
  } else {
    // 本轮未结束，移动到下一个玩家
    let nextPlayerIndex = (playerIndex + 1) % gameState.players.length;
    let attempts = 0;
    
    // 跳过已弃牌或全押的玩家
    while (attempts < gameState.players.length && 
           (gameState.players[nextPlayerIndex].isFolded || 
            gameState.players[nextPlayerIndex].isAllIn)) {
      nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
      attempts++;
    }
    
    gameState.currentPlayerIndex = nextPlayerIndex;
  }
  
  // 广播AI操作后的游戏状态
  room.clients.forEach((clientData, clientWs) => {
    const customizedGameState = JSON.parse(JSON.stringify(gameState));
    
    customizedGameState.players = customizedGameState.players.map((player, index) => {
      if (player.id === clientData.id) {
        return player;
      } else {
        return {
          ...player,
          cards: []
        };
      }
    });
    
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify({
        type: 'game-state-update',
        gameState: customizedGameState
      }));
    }
  });
  
  // 如果下一轮未结束且下一个玩家也是AI且未弃牌或全押，继续AI操作
  if (!roundEnded) {
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    if (nextPlayer && nextPlayer.type === 'ai' && 
        !nextPlayer.isFolded && !nextPlayer.isAllIn) {
      setTimeout(() => {
        handleAIPlayerAction(room, gameState.currentPlayerIndex);
      }, 1000); // 1秒后执行下一个AI操作
    }
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
        
        case 'add-ai-player': {
          console.log('收到添加AI玩家请求，currentRoom:', currentRoom);
          // 添加AI玩家
          if (!currentRoom) {
            console.log('错误：没有找到当前房间');
            break;
          }
          
          // 获取房间
          const room = rooms.get(currentRoom);
          if (!room) {
            console.log('错误：没有找到房间', currentRoom);
            break;
          }
          
          // 验证发送消息的客户端是否是房主（创建房间的客户端）
          if (room.host !== ws) {
            console.log('错误：只有房主可以添加AI玩家');
            // 向客户端发送错误消息
            ws.send(JSON.stringify({
              type: 'error',
              message: '只有房主可以添加AI玩家'
            }));
            break;
          }
          
          // 检查是否已达到最大玩家数
          if (room.clients.size >= 6) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '房间已满，无法添加更多玩家'
            }));
            break;
          }
          
          // 为新AI玩家分配ID
          const newAIPlayerId = room.clients.size;
          const aiPlayerName = `AI玩家${newAIPlayerId}`;
          
          // 添加AI玩家到房间客户端列表
          // 使用一个虚拟WebSocket对象来表示AI玩家，但实际上AI玩家不需要WebSocket连接
          // 我们只需要更新玩家列表，不需要真正的WebSocket连接
          
          // 向房主发送确认消息
          ws.send(JSON.stringify({
            type: 'ai-player-added',
            playerId: newAIPlayerId,
            playerName: aiPlayerName
          }));
          
          // 通知房间内所有玩家AI玩家已添加
          const updatedPlayers = Array.from(room.clients.entries()).map(([client, playerData]) => ({
            id: playerData.id,
            name: playerData.name
          }));
          
          // 添加AI玩家到列表
          updatedPlayers.push({
            id: newAIPlayerId,
            name: aiPlayerName
          });
          
          broadcastToRoom(currentRoom, {
            type: 'player-joined',
            playerId: newAIPlayerId,
            playerName: aiPlayerName,
            players: updatedPlayers
          });
          
          console.log(`AI玩家 ${aiPlayerName} 已添加到房间 ${currentRoom}`);
          break;
        }
          
        case 'start-game': {
          console.log('收到开始游戏请求，currentRoom:', currentRoom);
          // 开始游戏
          if (!currentRoom) {
            console.log('错误：没有找到当前房间');
            break;
          }
          
          // 获取房间
          const room = rooms.get(currentRoom);
          if (!room) {
            console.log('错误：没有找到房间', currentRoom);
            break;
          }
          
          // 验证发送消息的客户端是否是房主（创建房间的客户端）
          if (room.host !== ws) {
            console.log('错误：只有房主可以开始游戏');
            // 向客户端发送错误消息
            ws.send(JSON.stringify({
              type: 'error',
              message: '只有房主可以开始游戏'
            }));
            break;
          }
          
          console.log('房间找到，玩家数量：', room.clients.size);
          
          // 获取房间内的所有真实玩家
          const clientsArray = Array.from(room.clients.entries());
          let players = clientsArray.map(([client, clientData], index) => ({
            id: clientData.id,
            name: clientData.name,
            type: 'human', // 真实玩家
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
          
          // 如果玩家少于6人，自动添加AI玩家
          const maxPlayers = 6;
          const humanPlayersCount = players.length;
          
          if (humanPlayersCount < maxPlayers) {
            for (let i = humanPlayersCount; i < maxPlayers; i++) {
              players.push({
                id: i,
                name: `AI玩家${i}`,
                type: 'ai',
                chips: 1000,
                cards: [],
                currentBet: 0,
                totalBet: 0,
                isFolded: false,
                isAllIn: false,
                isDealer: false,
                isSmallBlind: false,
                isBigBlind: false,
                isActive: true
              });
            }
          }
          
          // 创建完整的牌堆
          const deck = [];
          const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
          const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
          
          for (const suit of suits) {
            for (const rank of ranks) {
              deck.push({ suit, rank });
            }
          }
          
          // 洗牌
          for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
          }
          
          // 给每个玩家发2张底牌
          for (let i = 0; i < players.length; i++) {
            players[i].cards = [deck.pop(), deck.pop()];
          }
          
          // 设置盲注位置 - 第一个玩家是小盲注，第二个玩家是大盲注
          if (players.length > 0) {
            players[0].isSmallBlind = true;
            players[1 % players.length].isBigBlind = true;
          }
          
          // 设置庄家位置 - 暂时设为第一个人
          if (players.length > 0) {
            players[0].isDealer = true;
          }
          
          // 设置当前行动玩家 - 从大盲注下家开始
          const smallBlindIndex = 0;
          const bigBlindIndex = 1 % players.length;
          const currentPlayerIndex = (bigBlindIndex + 1) % players.length;
          
          // 创建初始游戏状态
          const gameState = {
            players,
            communityCards: [], // 公共牌在游戏开始时为空
            pot: 0,
            currentBet: 20, // 大盲注金额
            phase: 'preflop', // 使用正确的阶段名称
            currentPlayerIndex: currentPlayerIndex,
            dealerIndex: 0,
            smallBlindAmount: 10,
            bigBlindAmount: 20,
            deck: deck, // 包含洗好的牌堆
            winners: [],
            message: '游戏开始',
            roundComplete: false,
            minRaise: 20, // 最小加注额
            lastRaiseAmount: 20, // 上次加注金额（大盲注）
            actionCount: 0
          };
          
          // 更新房间的游戏状态
          room.gameState = gameState;
          
          console.log('广播游戏开始消息到房间：', currentRoom);
          
          // 为每个客户端发送定制化的游戏状态，确保玩家只能看到自己的底牌
          room.clients.forEach((clientData, clientWs) => {
            // 复制游戏状态
            const customizedGameState = JSON.parse(JSON.stringify(gameState));
            
            // 隐藏其他玩家的底牌
            customizedGameState.players = customizedGameState.players.map((player, index) => {
              // 如果是当前客户端的玩家，保留底牌；否则隐藏底牌
              if (player.id === clientData.id) {
                return player; // 显示自己的底牌
              } else {
                // 隐藏其他玩家的底牌
                return {
                  ...player,
                  cards: [] // 隐藏底牌
                };
              }
            });
            
            // 发送定制化的游戏状态给当前客户端
            if (clientWs.readyState === 1) { // WebSocket.OPEN
              clientWs.send(JSON.stringify({
                type: 'game-started',
                gameState: customizedGameState
              }));
            }
          });
          
          // 检查第一个行动的玩家是否是AI，如果是，立即处理AI操作
          const firstPlayer = gameState.players[gameState.currentPlayerIndex];
          if (firstPlayer && firstPlayer.type === 'ai') {
            console.log(`游戏开始 - AI玩家 ${firstPlayer.name} 首先行动`);
            setTimeout(() => {
              handleAIPlayerAction(room, gameState.currentPlayerIndex);
            }, 1000); // 稍微延迟一下，确保客户端已接收初始状态
          }
          
          console.log('游戏开始消息已广播');
          break;
        }
        
        case 'player-action': {
          console.log('收到玩家操作消息:', message);
          // 玩家行动
          if (!currentRoom) {
            console.log('错误：没有当前房间');
            break;
          }
          
          const room = rooms.get(currentRoom);
          if (!room || !room.gameState) {
            console.log('错误：房间或游戏状态不存在');
            break;
          }
          
          // 如果游戏已经结束，忽略操作
          if (room.gameState.phase === 'showdown' || room.gameState.phase === 'ended') {
            console.log('游戏已经结束，忽略操作');
            break;
          }
          
          const { action, raiseAmount } = message;
          const currentPlayerIndex = room.gameState.currentPlayerIndex;
          const currentPlayer = room.gameState.players[currentPlayerIndex];
          
          console.log(`当前玩家ID: ${playerId}, 当前行动玩家ID: ${currentPlayer.id}, 类型: ${currentPlayer.type}`);
          
          // 验证是当前玩家且是人类玩家（AI玩家由服务器控制）
          if (currentPlayer.id !== playerId || currentPlayer.type !== 'human') {
            console.log('错误：不是当前玩家或当前玩家是AI');
            // 向客户端发送错误消息
            ws.send(JSON.stringify({
              type: 'error',
              message: '现在不是你的回合或操作无效'
            }));
            break;
          }
          
          console.log(`玩家 ${currentPlayer.name} 执行操作: ${action}`);
          
          // 更新玩家状态
          switch (action) {
            case 'fold':
              currentPlayer.isFolded = true;
              break;
              
            case 'call':
              // 计算跟注金额
              const callAmount = room.gameState.currentBet - currentPlayer.currentBet;
              if (callAmount > 0) {
                currentPlayer.chips -= callAmount;
                currentPlayer.currentBet += callAmount;
                room.gameState.pot += callAmount;
              }
              break;
              
            case 'raise':
              if (raiseAmount && raiseAmount > room.gameState.currentBet) {
                const raiseDiff = raiseAmount - currentPlayer.currentBet;
                currentPlayer.chips -= raiseDiff;
                currentPlayer.currentBet = raiseAmount;
                room.gameState.currentBet = raiseAmount;
                room.gameState.pot += raiseDiff;
                room.gameState.lastRaiseAmount = raiseAmount;
              }
              break;
              
            case 'check':
              // 检查只有在当前下注为0或玩家已下注相同金额时才有效
              break;
              
            case 'all-in':
              // 全押
              currentPlayer.currentBet += currentPlayer.chips;
              room.gameState.pot += currentPlayer.chips;
              currentPlayer.chips = 0;
              currentPlayer.isAllIn = true;
              break;
          }
          
          // 记录玩家最后的操作
          currentPlayer.lastAction = action;
          
          // 检查本轮是否结束
          const roundEnded = checkRoundEnd(room.gameState);
          
          if (roundEnded) {
            // 本轮结束，进入下一阶段
            advanceGamePhase(room);
          } else {
            // 本轮未结束，移动到下一个玩家
            let nextPlayerIndex = (currentPlayerIndex + 1) % room.gameState.players.length;
            let attempts = 0;
            
            // 跳过已弃牌或全押的玩家
            while (attempts < room.gameState.players.length && 
                   (room.gameState.players[nextPlayerIndex].isFolded || 
                    room.gameState.players[nextPlayerIndex].isAllIn)) {
              nextPlayerIndex = (nextPlayerIndex + 1) % room.gameState.players.length;
              attempts++;
            }
            
            room.gameState.currentPlayerIndex = nextPlayerIndex;
          }
          
          // 广播更新后的游戏状态
          room.clients.forEach((clientData, clientWs) => {
            // 复制游戏状态
            const customizedGameState = JSON.parse(JSON.stringify(room.gameState));
            
            // 隐藏其他玩家的底牌
            customizedGameState.players = customizedGameState.players.map((player, index) => {
              if (player.id === clientData.id) {
                return player; // 显示自己的底牌
              } else {
                return {
                  ...player,
                  cards: [] // 隐藏底牌
                };
              }
            });
            
            if (clientWs.readyState === 1) { // WebSocket.OPEN
              clientWs.send(JSON.stringify({
                type: 'game-state-update',
                gameState: customizedGameState
              }));
            }
          });
          
          // 检查是否需要AI玩家行动
          const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
          if (nextPlayer && nextPlayer.type === 'ai' && 
              !nextPlayer.isFolded && !nextPlayer.isAllIn) {
            setTimeout(() => {
              handleAIPlayerAction(room, room.gameState.currentPlayerIndex);
            }, 1000); // 1秒后执行AI操作，模拟思考时间
          }
          
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
