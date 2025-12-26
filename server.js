import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = 3001;
const server = createServer();
const wss = new WebSocketServer({ server });

// ======== 手牌评估逻辑 (从 handEvaluator.ts 移植) ========

// 牌值数字映射
const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 手牌等级分数
const HAND_RANK_SCORES = {
  'high-card': 1,
  'one-pair': 2,
  'two-pair': 3,
  'three-of-a-kind': 4,
  'straight': 5,
  'flush': 6,
  'full-house': 7,
  'four-of-a-kind': 8,
  'straight-flush': 9,
  'royal-flush': 10
};

// 手牌名称
const HAND_RANK_NAMES = {
  'high-card': '高牌',
  'one-pair': '一对',
  'two-pair': '两对',
  'three-of-a-kind': '三条',
  'straight': '顺子',
  'flush': '同花',
  'full-house': '葫芦',
  'four-of-a-kind': '四条',
  'straight-flush': '同花顺',
  'royal-flush': '皇家同花顺'
};

// 获取牌的数值
function getCardValue(card) {
  return RANK_VALUES[card.rank];
}

// 按牌值分组
function groupByRank(cards) {
  const groups = new Map();
  for (const card of cards) {
    const value = getCardValue(card);
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(card);
  }
  return groups;
}

// 按花色分组
function groupBySuit(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.suit)) {
      groups.set(card.suit, []);
    }
    groups.get(card.suit).push(card);
  }
  return groups;
}

// 检查是否为同花
function checkFlush(cards) {
  const suitGroups = groupBySuit(cards);
  for (const [, suited] of suitGroups) {
    if (suited.length >= 5) {
      return suited.sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, 5);
    }
  }
  return null;
}

// 检查是否为顺子
function checkStraight(cards) {
  const uniqueValues = [...new Set(cards.map(c => getCardValue(c)))].sort((a, b) => b - a);

  // 检查 A-2-3-4-5 (wheel)
  if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) &&
    uniqueValues.includes(4) && uniqueValues.includes(5)) {
    const straightCards = [];
    for (const v of [5, 4, 3, 2, 14]) {
      const card = cards.find(c => getCardValue(c) === v);
      if (card) straightCards.push(card);
    }
    return straightCards;
  }

  // 检查普通顺子
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    let isSequential = true;
    for (let j = 0; j < 4; j++) {
      if (uniqueValues[i + j] - uniqueValues[i + j + 1] !== 1) {
        isSequential = false;
        break;
      }
    }
    if (isSequential) {
      const straightCards = [];
      for (let j = 0; j < 5; j++) {
        const card = cards.find(c => getCardValue(c) === uniqueValues[i + j]);
        if (card) straightCards.push(card);
      }
      return straightCards;
    }
  }

  return null;
}

// 检查同花顺
function checkStraightFlush(cards) {
  const suitGroups = groupBySuit(cards);
  for (const [, suited] of suitGroups) {
    if (suited.length >= 5) {
      const straight = checkStraight(suited);
      if (straight) return straight;
    }
  }
  return null;
}

// 评估最佳5张牌
function evaluateHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    const sorted = allCards.sort((a, b) => getCardValue(b) - getCardValue(a));
    return {
      type: 'high-card',
      rank: HAND_RANK_SCORES['high-card'],
      highCards: sorted.map(c => getCardValue(c)),
      name: HAND_RANK_NAMES['high-card'],
      cards: sorted
    };
  }

  const rankGroups = groupByRank(allCards);
  const groupSizes = Array.from(rankGroups.entries())
    .map(([value, cards]) => ({ value, count: cards.length }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // 检查同花顺（包括皇家同花顺）
  const straightFlush = checkStraightFlush(allCards);
  if (straightFlush) {
    const highCard = Math.max(...straightFlush.map(c => getCardValue(c)));
    const type = highCard === 14 ? 'royal-flush' : 'straight-flush';
    return {
      type,
      rank: HAND_RANK_SCORES[type],
      highCards: straightFlush.map(c => getCardValue(c)),
      name: HAND_RANK_NAMES[type],
      cards: straightFlush
    };
  }

  // 检查四条
  if (groupSizes[0].count === 4) {
    const fourCards = rankGroups.get(groupSizes[0].value);
    const kicker = allCards
      .filter(c => getCardValue(c) !== groupSizes[0].value)
      .sort((a, b) => getCardValue(b) - getCardValue(a))[0];
    const bestCards = [...fourCards, kicker];
    return {
      type: 'four-of-a-kind',
      rank: HAND_RANK_SCORES['four-of-a-kind'],
      highCards: [groupSizes[0].value, getCardValue(kicker)],
      name: HAND_RANK_NAMES['four-of-a-kind'],
      cards: bestCards
    };
  }

  // 检查葫芦
  if (groupSizes[0].count === 3 && groupSizes[1]?.count >= 2) {
    const threeCards = rankGroups.get(groupSizes[0].value);
    const pairCards = rankGroups.get(groupSizes[1].value).slice(0, 2);
    const bestCards = [...threeCards, ...pairCards];
    return {
      type: 'full-house',
      rank: HAND_RANK_SCORES['full-house'],
      highCards: [groupSizes[0].value, groupSizes[1].value],
      name: HAND_RANK_NAMES['full-house'],
      cards: bestCards
    };
  }

  // 检查同花
  const flush = checkFlush(allCards);
  if (flush) {
    return {
      type: 'flush',
      rank: HAND_RANK_SCORES['flush'],
      highCards: flush.map(c => getCardValue(c)),
      name: HAND_RANK_NAMES['flush'],
      cards: flush
    };
  }

  // 检查顺子
  const straight = checkStraight(allCards);
  if (straight) {
    return {
      type: 'straight',
      rank: HAND_RANK_SCORES['straight'],
      highCards: straight.map(c => getCardValue(c)),
      name: HAND_RANK_NAMES['straight'],
      cards: straight
    };
  }

  // 检查三条
  if (groupSizes[0].count === 3) {
    const threeCards = rankGroups.get(groupSizes[0].value);
    const kickers = allCards
      .filter(c => getCardValue(c) !== groupSizes[0].value)
      .sort((a, b) => getCardValue(b) - getCardValue(a))
      .slice(0, 2);
    const bestCards = [...threeCards, ...kickers];
    return {
      type: 'three-of-a-kind',
      rank: HAND_RANK_SCORES['three-of-a-kind'],
      highCards: [groupSizes[0].value, ...kickers.map(c => getCardValue(c))],
      name: HAND_RANK_NAMES['three-of-a-kind'],
      cards: bestCards
    };
  }

  // 检查两对
  if (groupSizes[0].count === 2 && groupSizes[1]?.count === 2) {
    const pair1 = rankGroups.get(groupSizes[0].value);
    const pair2 = rankGroups.get(groupSizes[1].value);
    const kicker = allCards
      .filter(c => getCardValue(c) !== groupSizes[0].value && getCardValue(c) !== groupSizes[1].value)
      .sort((a, b) => getCardValue(b) - getCardValue(a))[0];
    const bestCards = [...pair1, ...pair2, kicker];
    return {
      type: 'two-pair',
      rank: HAND_RANK_SCORES['two-pair'],
      highCards: [groupSizes[0].value, groupSizes[1].value, getCardValue(kicker)],
      name: HAND_RANK_NAMES['two-pair'],
      cards: bestCards
    };
  }

  // 检查一对
  if (groupSizes[0].count === 2) {
    const pairCards = rankGroups.get(groupSizes[0].value);
    const kickers = allCards
      .filter(c => getCardValue(c) !== groupSizes[0].value)
      .sort((a, b) => getCardValue(b) - getCardValue(a))
      .slice(0, 3);
    const bestCards = [...pairCards, ...kickers];
    return {
      type: 'one-pair',
      rank: HAND_RANK_SCORES['one-pair'],
      highCards: [groupSizes[0].value, ...kickers.map(c => getCardValue(c))],
      name: HAND_RANK_NAMES['one-pair'],
      cards: bestCards
    };
  }

  // 高牌
  const sorted = allCards.sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, 5);
  return {
    type: 'high-card',
    rank: HAND_RANK_SCORES['high-card'],
    highCards: sorted.map(c => getCardValue(c)),
    name: HAND_RANK_NAMES['high-card'],
    cards: sorted
  };
}

// 比较两个手牌等级
function compareHands(hand1, hand2) {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }

  for (let i = 0; i < Math.min(hand1.highCards.length, hand2.highCards.length); i++) {
    if (hand1.highCards[i] !== hand2.highCards[i]) {
      return hand1.highCards[i] - hand2.highCards[i];
    }
  }

  return 0;
}

// 找出获胜者
function findWinnersFromHands(hands) {
  let bestRank = null;
  let winners = [];

  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    if (!hand) continue;

    if (!bestRank) {
      bestRank = hand;
      winners = [i];
    } else {
      const comparison = compareHands(hand, bestRank);
      if (comparison > 0) {
        bestRank = hand;
        winners = [i];
      } else if (comparison === 0) {
        winners.push(i);
      }
    }
  }

  return winners;
}

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

// 处理摊牌结算
function handleShowdown(room) {
  const gameState = room.gameState;
  if (!gameState) return;

  console.log('处理摊牌结算...');

  // 评估所有未弃牌玩家的手牌
  const remainingPlayers = gameState.players.filter(p => !p.isFolded);

  for (const player of remainingPlayers) {
    player.handRank = evaluateHand(player.cards, gameState.communityCards);
    console.log(`玩家 ${player.name} 手牌: ${player.handRank.name}`);
  }

  // 找出获胜者
  const hands = gameState.players.map(p => p.isFolded ? null : p.handRank || null);
  const winnerIndices = findWinnersFromHands(hands);

  gameState.winners = winnerIndices;

  // 分配奖池
  const winAmount = Math.floor(gameState.pot / winnerIndices.length);
  for (const winnerIndex of winnerIndices) {
    gameState.players[winnerIndex].chips += winAmount;
  }

  // 处理余数
  const remainder = gameState.pot - (winAmount * winnerIndices.length);
  if (remainder > 0 && winnerIndices.length > 0) {
    gameState.players[winnerIndices[0]].chips += remainder;
  }

  const winnerNames = winnerIndices.map(i => gameState.players[i].name).join(', ');
  const winningHand = gameState.players[winnerIndices[0]]?.handRank?.name || '';

  if (winnerIndices.length === 1) {
    gameState.message = `${winnerNames} 获胜！${winningHand}，赢得 ${gameState.pot} 筹码`;
  } else {
    gameState.message = `平局！${winnerNames} 平分奖池，各得 ${winAmount} 筹码`;
  }

  console.log(gameState.message);

  gameState.pot = 0;
  gameState.roundComplete = true;

  // 广播最终游戏状态 - 在showdown阶段，显示所有玩家的底牌
  broadcastShowdownState(room);
}

// 处理所有人弃牌只剩一个玩家的情况
function handleWinner(room) {
  const gameState = room.gameState;
  if (!gameState) return;

  const winner = gameState.players.find(p => !p.isFolded);
  if (!winner) return;

  console.log(`处理弃牌胜利: ${winner.name} 获胜`);

  winner.chips += gameState.pot;
  gameState.winners = [winner.id];
  gameState.message = `${winner.name} 获胜！其他玩家全部弃牌，赢得 ${gameState.pot} 筹码`;
  gameState.pot = 0;
  gameState.roundComplete = true;
  gameState.phase = 'showdown';

  console.log(gameState.message);

  // 广播最终游戏状态
  broadcastShowdownState(room);
}

// 广播摊牌阶段的游戏状态（显示所有玩家的底牌）
function broadcastShowdownState(room) {
  const gameState = room.gameState;
  if (!gameState) return;

  // 调试日志：打印原始底牌数据
  console.log('=== broadcastShowdownState 调试 ===');
  gameState.players.forEach((player, index) => {
    console.log(`玩家 ${player.name} (index ${index}): isFolded=${player.isFolded}, cards=${JSON.stringify(player.cards)}`);
  });

  room.clients.forEach((clientData, clientWs) => {
    // 在showdown阶段，显示所有未弃牌玩家的底牌
    const showdownGameState = JSON.parse(JSON.stringify(gameState));

    // 只隐藏已弃牌玩家的底牌
    showdownGameState.players = showdownGameState.players.map((player) => {
      if (player.isFolded) {
        return {
          ...player,
          cards: [] // 隐藏已弃牌玩家的底牌
        };
      }
      return player; // 显示未弃牌玩家的底牌
    });

    console.log(`发送给客户端 ${clientData.name}:`, showdownGameState.players.map(p => ({ name: p.name, cards: p.cards?.length })));

    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify({
        type: 'game-state-update',
        gameState: showdownGameState
      }));
    }
  });
}

// 推进游戏阶段
function advanceGamePhase(room) {
  const gameState = room.gameState;
  if (!gameState) return;

  console.log(`推进游戏阶段: ${gameState.phase} -> ...`);

  let nextPlayerIndex = -1;

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
      // 重置所有玩家的当前下注和lastAction
      resetPlayerBets(gameState);
      resetPlayerActions(gameState);
      // 设置庄家位置的下一个玩家为当前行动玩家
      nextPlayerIndex = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextPlayerIndex !== -1) {
        gameState.currentPlayerIndex = nextPlayerIndex;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
        handleShowdown(room);
        return;
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
      resetPlayerActions(gameState);
      nextPlayerIndex = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextPlayerIndex !== -1) {
        gameState.currentPlayerIndex = nextPlayerIndex;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
        handleShowdown(room);
        return;
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
      resetPlayerActions(gameState);
      nextPlayerIndex = findNextActivePlayer(gameState, gameState.dealerIndex);
      if (nextPlayerIndex !== -1) {
        gameState.currentPlayerIndex = nextPlayerIndex;
      } else {
        // 如果没有活跃玩家，可能所有玩家都弃牌了
        gameState.phase = 'showdown';
        handleShowdown(room);
        return;
      }
      break;

    case 'river': // 河牌阶段
      // 河牌圈结束后，进入摊牌阶段
      gameState.phase = 'showdown';
      console.log(`进入 showdown 阶段，所有公共牌: ${JSON.stringify(gameState.communityCards)}`);
      // 计算胜负并结算
      handleShowdown(room);
      return; // 结算后直接返回，不需要继续广播

    case 'showdown':
      // 摊牌阶段，可以计算胜负，但现在简化处理
      console.log(`在 showdown 阶段，游戏状态: ${JSON.stringify(gameState.phase)}`);
      return;

    default:
      console.log(`未知游戏阶段: ${gameState.phase}`);
      return;
  }

  // 广播阶段切换后的游戏状态
  room.clients.forEach((clientData, clientWs) => {
    const customizedGameState = JSON.parse(JSON.stringify(gameState));

    customizedGameState.players = customizedGameState.players.map((player) => {
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

  // 如果下一个玩家是AI，触发AI行动
  const nextPlayer = gameState.players[gameState.currentPlayerIndex];
  if (nextPlayer && nextPlayer.type === 'ai' && !nextPlayer.isFolded && !nextPlayer.isAllIn) {
    console.log(`阶段切换后，触发 AI 玩家 ${nextPlayer.name} 行动`);
    setTimeout(() => {
      handleAIPlayerAction(room, gameState.currentPlayerIndex);
    }, 1000);
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

// 重置玩家行动状态（在新阶段开始时）
function resetPlayerActions(gameState) {
  gameState.players.forEach(player => {
    if (!player.isFolded && !player.isAllIn) {
      player.lastAction = null;
    }
  });
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

  // 检查是否只剩一个玩家（其他人都弃牌了）
  const remainingPlayers = gameState.players.filter(p => !p.isFolded);
  if (remainingPlayers.length === 1) {
    handleWinner(room);
    return; // handleWinner会广播状态，直接返回
  }

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

          // 检查是否只剩一个玩家（其他人都弃牌了）
          const remainingPlayers = room.gameState.players.filter(p => !p.isFolded);
          if (remainingPlayers.length === 1) {
            handleWinner(room);
            break; // handleWinner会广播状态，直接返回
          }

          // 检查本轮是否结束
          const roundEnded = checkRoundEnd(room.gameState);

          if (roundEnded) {
            // 本轮结束，进入下一阶段
            // advanceGamePhase 会自己广播状态（包括 showdown 时的完整底牌），所以这里直接 break
            advanceGamePhase(room);
            break; // 重要：不要继续执行下面的广播代码，否则会覆盖 showdown 的底牌数据
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

        case 'start-next-round': {
          console.log('收到开始下一轮请求');
          if (!currentRoom) {
            console.log('错误：没有找到当前房间');
            break;
          }

          const room = rooms.get(currentRoom);
          if (!room || !room.gameState) {
            console.log('错误：房间或游戏状态不存在');
            break;
          }

          // 验证是房主
          if (room.host !== ws) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '只有房主可以开始下一轮'
            }));
            break;
          }

          // 验证当前轮完成
          if (!room.gameState.roundComplete) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '当前轮尚未结束'
            }));
            break;
          }

          const gameState = room.gameState;

          // 保留筹码信息，重置其他状态
          const playerChips = {};
          gameState.players.forEach(p => {
            playerChips[p.id] = p.chips;
          });

          // 移动庄家位置
          let newDealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;

          // 检查是否有玩家出局
          const activePlayers = gameState.players.filter(p => playerChips[p.id] > 0);
          if (activePlayers.length < 2) {
            gameState.phase = 'ended';
            gameState.message = '游戏结束！玩家不足，无法继续';
            broadcastShowdownState(room);
            break;
          }

          // 重置游戏状态
          gameState.players.forEach(player => {
            player.cards = [];
            player.currentBet = 0;
            player.totalBet = 0;
            player.isFolded = playerChips[player.id] <= 0; // 没有筹码的玩家视为弃牌
            player.isAllIn = false;
            player.isDealer = false;
            player.isSmallBlind = false;
            player.isBigBlind = false;
            player.isActive = playerChips[player.id] > 0;
            player.lastAction = undefined;
            player.handRank = undefined;
            player.chips = playerChips[player.id];
          });

          // 找到下一个有筹码的庄家
          while (gameState.players[newDealerIndex].chips <= 0) {
            newDealerIndex = (newDealerIndex + 1) % gameState.players.length;
          }
          gameState.dealerIndex = newDealerIndex;
          gameState.players[newDealerIndex].isDealer = true;

          // 设置小盲和大盲
          let smallBlindIndex = newDealerIndex;
          let attempts = 0;
          do {
            smallBlindIndex = (smallBlindIndex + 1) % gameState.players.length;
            attempts++;
          } while (gameState.players[smallBlindIndex].chips <= 0 && attempts < gameState.players.length);

          let bigBlindIndex = smallBlindIndex;
          attempts = 0;
          do {
            bigBlindIndex = (bigBlindIndex + 1) % gameState.players.length;
            attempts++;
          } while (gameState.players[bigBlindIndex].chips <= 0 && attempts < gameState.players.length);

          gameState.players[smallBlindIndex].isSmallBlind = true;
          gameState.players[bigBlindIndex].isBigBlind = true;

          // 扣除盲注
          const smallBlindAmount = Math.min(gameState.smallBlindAmount, gameState.players[smallBlindIndex].chips);
          const bigBlindAmount = Math.min(gameState.bigBlindAmount, gameState.players[bigBlindIndex].chips);

          gameState.players[smallBlindIndex].chips -= smallBlindAmount;
          gameState.players[smallBlindIndex].currentBet = smallBlindAmount;
          gameState.players[smallBlindIndex].totalBet = smallBlindAmount;

          gameState.players[bigBlindIndex].chips -= bigBlindAmount;
          gameState.players[bigBlindIndex].currentBet = bigBlindAmount;
          gameState.players[bigBlindIndex].totalBet = bigBlindAmount;

          if (gameState.players[smallBlindIndex].chips === 0) {
            gameState.players[smallBlindIndex].isAllIn = true;
          }
          if (gameState.players[bigBlindIndex].chips === 0) {
            gameState.players[bigBlindIndex].isAllIn = true;
          }

          gameState.pot = smallBlindAmount + bigBlindAmount;
          gameState.currentBet = bigBlindAmount;
          gameState.minRaise = gameState.bigBlindAmount;
          gameState.lastRaiseAmount = gameState.bigBlindAmount;

          // 创建新牌堆
          const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
          const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
          const deck = [];
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
          gameState.deck = deck;

          // 发牌给有筹码的玩家
          for (const player of gameState.players) {
            if (player.isActive && player.chips >= 0) {
              player.cards = [deck.pop(), deck.pop()];
            }
          }

          // 设置当前玩家（大盲注后的下一个有筹码的玩家）
          let currentIndex = bigBlindIndex;
          attempts = 0;
          do {
            currentIndex = (currentIndex + 1) % gameState.players.length;
            attempts++;
          } while ((gameState.players[currentIndex].chips <= 0 || gameState.players[currentIndex].isFolded) && attempts < gameState.players.length);

          gameState.currentPlayerIndex = currentIndex;
          gameState.phase = 'preflop';
          gameState.communityCards = [];
          gameState.winners = [];
          gameState.roundComplete = false;
          gameState.actionCount = 0;
          gameState.message = `${gameState.players[currentIndex].name} 行动`;

          console.log('开始下一轮，广播新状态...');

          // 广播新游戏状态
          room.clients.forEach((clientData, clientWs) => {
            const customizedGameState = JSON.parse(JSON.stringify(gameState));
            customizedGameState.players = customizedGameState.players.map((player) => {
              if (player.id === clientData.id) {
                return player;
              } else {
                return { ...player, cards: [] };
              }
            });

            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({
                type: 'game-state-update',
                gameState: customizedGameState
              }));
            }
          });

          // 如果第一个玩家是AI，执行AI操作
          const firstPlayer = gameState.players[gameState.currentPlayerIndex];
          if (firstPlayer && firstPlayer.type === 'ai' && !firstPlayer.isFolded && !firstPlayer.isAllIn) {
            setTimeout(() => {
              handleAIPlayerAction(room, gameState.currentPlayerIndex);
            }, 1000);
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
