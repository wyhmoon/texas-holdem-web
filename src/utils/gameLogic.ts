import type { GameState, Player, PlayerAction } from '../types';
import { createDeck, shuffleDeck, drawCards } from './deck';
import { evaluateHand, findWinners } from './handEvaluator';

const INITIAL_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

// 创建初始玩家
export function createPlayers(): Player[] {
  const players: Player[] = [
    {
      id: 0,
      name: '你',
      type: 'human',
      chips: INITIAL_CHIPS,
      cards: [],
      currentBet: 0,
      totalBet: 0,
      isFolded: false,
      isAllIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isActive: true
    }
  ];
  
  const aiNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  for (let i = 0; i < 5; i++) {
    players.push({
      id: i + 1,
      name: aiNames[i],
      type: 'ai',
      chips: INITIAL_CHIPS,
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
  
  return players;
}

// 创建初始游戏状态
export function createInitialGameState(): GameState {
  return {
    players: createPlayers(),
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: 'waiting',
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlindAmount: SMALL_BLIND,
    bigBlindAmount: BIG_BLIND,
    deck: [],
    winners: [],
    message: '点击"开始游戏"开始新一轮',
    roundComplete: false,
    minRaise: BIG_BLIND,
    lastRaiseAmount: BIG_BLIND,
    actionCount: 0
  };
}

// 获取活跃玩家数量
export function getActivePlayers(players: Player[]): Player[] {
  return players.filter(p => !p.isFolded && p.chips > 0);
}

// 获取仍在本轮的玩家
export function getPlayersInRound(players: Player[]): Player[] {
  return players.filter(p => !p.isFolded && !p.isAllIn);
}

// 获取下一个活跃玩家索引
export function getNextActivePlayerIndex(players: Player[], currentIndex: number): number {
  let nextIndex = (currentIndex + 1) % players.length;
  let attempts = 0;
  
  while (attempts < players.length) {
    const player = players[nextIndex];
    if (!player.isFolded && !player.isAllIn && player.chips > 0) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % players.length;
    attempts++;
  }
  
  return -1; // 没有活跃玩家
}

// 开始新一轮
export function startNewRound(state: GameState): GameState {
  const newState = { ...state };
  
  // 移除没有筹码的玩家
  newState.players = newState.players.map(p => ({
    ...p,
    isActive: p.chips > 0
  }));
  
  const activePlayers = newState.players.filter(p => p.isActive);
  if (activePlayers.length < 2) {
    newState.phase = 'ended';
    newState.message = '游戏结束！';
    return newState;
  }
  
  // 重置玩家状态
  newState.players = newState.players.map(p => ({
    ...p,
    cards: [],
    currentBet: 0,
    totalBet: 0,
    isFolded: !p.isActive,
    isAllIn: false,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    lastAction: undefined,
    handRank: undefined
  }));
  
  // 移动庄家位置
  let newDealerIndex = (newState.dealerIndex + 1) % newState.players.length;
  while (!newState.players[newDealerIndex].isActive) {
    newDealerIndex = (newDealerIndex + 1) % newState.players.length;
  }
  newState.dealerIndex = newDealerIndex;
  newState.players[newDealerIndex].isDealer = true;
  
  // 设置小盲和大盲
  let smallBlindIndex = getNextActivePlayerIndex(newState.players, newDealerIndex);
  let bigBlindIndex = getNextActivePlayerIndex(newState.players, smallBlindIndex);
  
  newState.players[smallBlindIndex].isSmallBlind = true;
  newState.players[bigBlindIndex].isBigBlind = true;
  
  // 扣除盲注
  const smallBlindAmount = Math.min(newState.smallBlindAmount, newState.players[smallBlindIndex].chips);
  const bigBlindAmount = Math.min(newState.bigBlindAmount, newState.players[bigBlindIndex].chips);
  
  newState.players[smallBlindIndex].chips -= smallBlindAmount;
  newState.players[smallBlindIndex].currentBet = smallBlindAmount;
  newState.players[smallBlindIndex].totalBet = smallBlindAmount;
  
  newState.players[bigBlindIndex].chips -= bigBlindAmount;
  newState.players[bigBlindIndex].currentBet = bigBlindAmount;
  newState.players[bigBlindIndex].totalBet = bigBlindAmount;
  
  if (newState.players[smallBlindIndex].chips === 0) {
    newState.players[smallBlindIndex].isAllIn = true;
  }
  if (newState.players[bigBlindIndex].chips === 0) {
    newState.players[bigBlindIndex].isAllIn = true;
  }
  
  newState.pot = smallBlindAmount + bigBlindAmount;
  newState.currentBet = bigBlindAmount;
  newState.minRaise = newState.bigBlindAmount;
  newState.lastRaiseAmount = newState.bigBlindAmount;
  
  // 洗牌并发牌
  newState.deck = shuffleDeck(createDeck());
  
  // 给每个活跃玩家发2张牌
  for (const player of newState.players) {
    if (player.isActive) {
      const { cards, remainingDeck } = drawCards(newState.deck, 2);
      player.cards = cards;
      newState.deck = remainingDeck;
    }
  }
  
  // 设置当前玩家（大盲注后面的玩家）
  newState.currentPlayerIndex = getNextActivePlayerIndex(newState.players, bigBlindIndex);
  newState.phase = 'preflop';
  newState.communityCards = [];
  newState.winners = [];
  newState.roundComplete = false;
  newState.actionCount = 0;
  newState.message = `${newState.players[newState.currentPlayerIndex].name} 行动`;
  
  return newState;
}

// 检查当前下注轮是否结束
export function isBettingRoundComplete(state: GameState): boolean {
  const playersInRound = getPlayersInRound(state.players);
  
  // 只剩一个玩家没弃牌
  if (getActivePlayers(state.players).filter(p => !p.isFolded).length <= 1) {
    return true;
  }
  
  // 如果没有可以行动的玩家
  if (playersInRound.length === 0) {
    return true;
  }
  
  // 检查是否所有玩家都已行动且下注相同
  const activePlayers = state.players.filter(p => !p.isFolded && p.isActive);
  const allBetsEqual = activePlayers.every(
    p => p.isAllIn || p.currentBet === state.currentBet
  );
  
  // 每个人都必须至少行动一次（除了 all-in 的玩家）
  const allActed = activePlayers.every(
    p => p.isAllIn || p.lastAction !== undefined
  );
  
  return allBetsEqual && allActed && state.actionCount >= playersInRound.length;
}

// 进入下一阶段
export function advanceToNextPhase(state: GameState): GameState {
  const newState = { ...state };
  
  // 重置玩家的当前下注和行动
  newState.players = newState.players.map(p => ({
    ...p,
    currentBet: 0,
    lastAction: undefined
  }));
  newState.currentBet = 0;
  newState.actionCount = 0;
  newState.minRaise = newState.bigBlindAmount;
  newState.lastRaiseAmount = 0;
  
  // 检查是否只剩一个玩家
  const remainingPlayers = newState.players.filter(p => !p.isFolded);
  if (remainingPlayers.length === 1) {
    return handleWinner(newState);
  }
  
  switch (newState.phase) {
    case 'preflop': {
      // 发翻牌（3张公共牌）
      const { cards, remainingDeck } = drawCards(newState.deck, 3);
      newState.communityCards = cards;
      newState.deck = remainingDeck;
      newState.phase = 'flop';
      break;
    }
    case 'flop': {
      // 发转牌（第4张公共牌）
      const { cards, remainingDeck } = drawCards(newState.deck, 1);
      newState.communityCards = [...newState.communityCards, ...cards];
      newState.deck = remainingDeck;
      newState.phase = 'turn';
      break;
    }
    case 'turn': {
      // 发河牌（第5张公共牌）
      const { cards, remainingDeck } = drawCards(newState.deck, 1);
      newState.communityCards = [...newState.communityCards, ...cards];
      newState.deck = remainingDeck;
      newState.phase = 'river';
      break;
    }
    case 'river': {
      // 摊牌
      newState.phase = 'showdown';
      return handleShowdown(newState);
    }
  }
  
  // 设置下一个行动玩家（庄家后第一个活跃玩家）
  newState.currentPlayerIndex = getNextActivePlayerIndex(newState.players, newState.dealerIndex);
  
  // 检查是否所有人都 all-in
  const playersCanAct = newState.players.filter(p => !p.isFolded && !p.isAllIn);
  if (playersCanAct.length <= 1) {
    // 直接发完所有公共牌
    return runOutBoard(newState);
  }
  
  newState.message = `${newState.players[newState.currentPlayerIndex].name} 行动`;
  
  return newState;
}

// 发完所有公共牌（当所有人都 all-in 时）
function runOutBoard(state: GameState): GameState {
  let newState = { ...state };
  
  while (newState.communityCards.length < 5) {
    const { cards, remainingDeck } = drawCards(newState.deck, 1);
    newState.communityCards = [...newState.communityCards, ...cards];
    newState.deck = remainingDeck;
  }
  
  newState.phase = 'showdown';
  return handleShowdown(newState);
}

// 处理摊牌
function handleShowdown(state: GameState): GameState {
  const newState = { ...state };
  
  // 评估所有未弃牌玩家的手牌
  const remainingPlayers = newState.players.filter(p => !p.isFolded);
  
  for (const player of remainingPlayers) {
    player.handRank = evaluateHand(player.cards, newState.communityCards);
  }
  
  // 找出获胜者
  const hands = newState.players.map(p => p.isFolded ? null : p.handRank || null);
  const winnerIndices = findWinners(hands);
  
  newState.winners = winnerIndices;
  
  // 分配奖池
  const winAmount = Math.floor(newState.pot / winnerIndices.length);
  for (const winnerIndex of winnerIndices) {
    newState.players[winnerIndex].chips += winAmount;
  }
  
  // 处理余数
  const remainder = newState.pot - (winAmount * winnerIndices.length);
  if (remainder > 0) {
    newState.players[winnerIndices[0]].chips += remainder;
  }
  
  const winnerNames = winnerIndices.map(i => newState.players[i].name).join(', ');
  const winningHand = newState.players[winnerIndices[0]].handRank?.name || '';
  
  if (winnerIndices.length === 1) {
    newState.message = `${winnerNames} 获胜！${winningHand}，赢得 ${newState.pot} 筹码`;
  } else {
    newState.message = `平局！${winnerNames} 平分奖池，各得 ${winAmount} 筹码`;
  }
  
  newState.pot = 0;
  newState.roundComplete = true;
  
  return newState;
}

// 处理只剩一个玩家的情况
function handleWinner(state: GameState): GameState {
  const newState = { ...state };
  const winner = newState.players.find(p => !p.isFolded)!;
  
  winner.chips += newState.pot;
  newState.winners = [winner.id];
  newState.message = `${winner.name} 获胜！其他玩家全部弃牌，赢得 ${newState.pot} 筹码`;
  newState.pot = 0;
  newState.roundComplete = true;
  newState.phase = 'showdown';
  
  return newState;
}

// 玩家行动
export function playerAction(
  state: GameState,
  playerIndex: number,
  action: PlayerAction,
  raiseAmount?: number
): GameState {
  let newState = { ...state };
  const player = { ...newState.players[playerIndex] };
  newState.players = [...newState.players];
  newState.players[playerIndex] = player;
  
  switch (action) {
    case 'fold':
      player.isFolded = true;
      player.lastAction = 'fold';
      newState.message = `${player.name} 弃牌`;
      break;
      
    case 'check':
      player.lastAction = 'check';
      newState.message = `${player.name} 过牌`;
      break;
      
    case 'call': {
      const callAmount = Math.min(newState.currentBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalBet += callAmount;
      newState.pot += callAmount;
      
      if (player.chips === 0) {
        player.isAllIn = true;
        player.lastAction = 'all-in';
        newState.message = `${player.name} 全押 (跟注)`;
      } else {
        player.lastAction = 'call';
        newState.message = `${player.name} 跟注 ${callAmount}`;
      }
      break;
    }
      
    case 'raise': {
      const totalRaise = raiseAmount || (newState.currentBet + newState.minRaise);
      const raiseAmountNeeded = totalRaise - player.currentBet;
      const actualRaise = Math.min(raiseAmountNeeded, player.chips);
      
      player.chips -= actualRaise;
      player.currentBet += actualRaise;
      player.totalBet += actualRaise;
      newState.pot += actualRaise;
      
      const newBet = player.currentBet;
      newState.lastRaiseAmount = newBet - newState.currentBet;
      newState.minRaise = Math.max(newState.lastRaiseAmount, newState.bigBlindAmount);
      newState.currentBet = newBet;
      
      if (player.chips === 0) {
        player.isAllIn = true;
        player.lastAction = 'all-in';
        newState.message = `${player.name} 全押 ${player.currentBet}`;
      } else {
        player.lastAction = 'raise';
        newState.message = `${player.name} 加注到 ${player.currentBet}`;
      }
      
      // 加注后重置其他玩家的行动状态
      newState.players = newState.players.map((p, i) => {
        if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
          return { ...p, lastAction: undefined };
        }
        return p;
      });
      newState.actionCount = 0;
      break;
    }
      
    case 'all-in': {
      const allInAmount = player.chips;
      player.currentBet += allInAmount;
      player.totalBet += allInAmount;
      newState.pot += allInAmount;
      player.chips = 0;
      player.isAllIn = true;
      player.lastAction = 'all-in';
      
      if (player.currentBet > newState.currentBet) {
        newState.lastRaiseAmount = player.currentBet - newState.currentBet;
        newState.minRaise = Math.max(newState.lastRaiseAmount, newState.bigBlindAmount);
        newState.currentBet = player.currentBet;
        
        // 加注后重置其他玩家的行动状态
        newState.players = newState.players.map((p, i) => {
          if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
            return { ...p, lastAction: undefined };
          }
          return p;
        });
        newState.actionCount = 0;
      }
      
      newState.message = `${player.name} 全押 ${player.currentBet}`;
      break;
    }
  }
  
  newState.actionCount++;
  
  // 检查是否只剩一个玩家
  const remainingPlayers = newState.players.filter(p => !p.isFolded);
  if (remainingPlayers.length === 1) {
    return handleWinner(newState);
  }
  
  // 检查下注轮是否结束
  if (isBettingRoundComplete(newState)) {
    return advanceToNextPhase(newState);
  }
  
  // 移动到下一个玩家
  newState.currentPlayerIndex = getNextActivePlayerIndex(newState.players, playerIndex);
  
  if (newState.currentPlayerIndex === -1) {
    return advanceToNextPhase(newState);
  }
  
  newState.message = `${newState.players[newState.currentPlayerIndex].name} 行动`;
  
  return newState;
}

// 获取玩家可用的行动
export function getAvailableActions(state: GameState, playerIndex: number): PlayerAction[] {
  const player = state.players[playerIndex];
  const actions: PlayerAction[] = ['fold'];
  
  if (player.isFolded || player.isAllIn) {
    return [];
  }
  
  // 如果当前没有下注或玩家已经跟上
  if (player.currentBet === state.currentBet) {
    actions.push('check');
  }
  
  // 如果需要跟注
  if (state.currentBet > player.currentBet && player.chips > 0) {
    const callAmount = state.currentBet - player.currentBet;
    if (callAmount < player.chips) {
      actions.push('call');
    }
  }
  
  // 如果可以加注
  const minRaiseTotal = state.currentBet + state.minRaise;
  if (player.chips > (state.currentBet - player.currentBet) && player.chips >= minRaiseTotal - player.currentBet) {
    actions.push('raise');
  }
  
  // 总是可以全押（如果有筹码）
  if (player.chips > 0) {
    actions.push('all-in');
  }
  
  return actions;
}

// 获取跟注金额
export function getCallAmount(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  return Math.min(state.currentBet - player.currentBet, player.chips);
}

// 获取最小加注金额
export function getMinRaiseAmount(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  return state.currentBet + state.minRaise - player.currentBet;
}
