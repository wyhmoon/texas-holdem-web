import type { GameState, PlayerAction, Card } from '../types';
import { RANK_VALUES } from '../types';
import { getAvailableActions, getCallAmount, getMinRaiseAmount } from './gameLogic';

// 评估手牌强度 (0-1)
function evaluateHandStrength(holeCards: Card[], communityCards: Card[]): number {
  const card1 = holeCards[0];
  const card2 = holeCards[1];
  
  const rank1 = RANK_VALUES[card1.rank];
  const rank2 = RANK_VALUES[card2.rank];
  const highCard = Math.max(rank1, rank2);
  const lowCard = Math.min(rank1, rank2);
  const isPair = rank1 === rank2;
  const isSuited = card1.suit === card2.suit;
  const gap = highCard - lowCard;
  
  let strength = 0;
  
  // 对子评估
  if (isPair) {
    strength = 0.5 + (rank1 / 14) * 0.4; // AA = 0.9, 22 = 0.57
  } else {
    // 高牌价值
    strength = (highCard / 14) * 0.3 + (lowCard / 14) * 0.1;
    
    // 同花加成
    if (isSuited) {
      strength += 0.1;
    }
    
    // 连张加成
    if (gap <= 2) {
      strength += 0.05 * (3 - gap);
    }
    
    // 特殊手牌
    if (highCard === 14 && lowCard >= 10) {
      strength += 0.15; // AK, AQ, AJ, AT
    }
    if (highCard === 13 && lowCard >= 11) {
      strength += 0.1; // KQ, KJ
    }
  }
  
  // 根据公共牌调整
  if (communityCards.length > 0) {
    const allCards = [...holeCards, ...communityCards];
    
    // 检查是否有对子
    const ranks = allCards.map(c => RANK_VALUES[c.rank]);
    const rankCounts = new Map<number, number>();
    for (const r of ranks) {
      rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
    }
    
    const maxCount = Math.max(...rankCounts.values());
    const pairCount = [...rankCounts.values()].filter(c => c >= 2).length;
    
    if (maxCount >= 4) strength = 0.95; // 四条
    else if (maxCount === 3 && pairCount >= 2) strength = 0.9; // 葫芦
    else if (maxCount === 3) strength = 0.75; // 三条
    else if (pairCount >= 2) strength = 0.65; // 两对
    else if (pairCount === 1) strength = Math.max(strength, 0.5); // 一对
    
    // 检查同花可能
    const suits = allCards.map(c => c.suit);
    const suitCounts = new Map<string, number>();
    for (const s of suits) {
      suitCounts.set(s, (suitCounts.get(s) || 0) + 1);
    }
    const maxSuitCount = Math.max(...suitCounts.values());
    if (maxSuitCount >= 5) strength = Math.max(strength, 0.85); // 同花
    else if (maxSuitCount === 4) strength += 0.1; // 同花听牌
    
    // 检查顺子可能
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    let maxConsecutive = 1;
    let consecutive = 1;
    for (let i = 1; i < uniqueRanks.length; i++) {
      if (uniqueRanks[i] - uniqueRanks[i - 1] === 1) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 1;
      }
    }
    if (maxConsecutive >= 5) strength = Math.max(strength, 0.8); // 顺子
    else if (maxConsecutive === 4) strength += 0.1; // 顺子听牌
  }
  
  return Math.min(1, Math.max(0, strength));
}

// 计算底池赔率
function getPotOdds(state: GameState, playerIndex: number): number {
  const callAmount = getCallAmount(state, playerIndex);
  if (callAmount === 0) return 1;
  return callAmount / (state.pot + callAmount);
}

// AI决策
export function makeAIDecision(state: GameState, playerIndex: number): { action: PlayerAction; raiseAmount?: number } {
  const player = state.players[playerIndex];
  const availableActions = getAvailableActions(state, playerIndex);
  
  if (availableActions.length === 0) {
    return { action: 'fold' };
  }
  
  const handStrength = evaluateHandStrength(player.cards, state.communityCards);
  const potOdds = getPotOdds(state, playerIndex);
  const callAmount = getCallAmount(state, playerIndex);
  const position = getPosition(state, playerIndex);
  
  // 添加一些随机性
  const randomFactor = Math.random() * 0.15 - 0.075;
  const adjustedStrength = handStrength + randomFactor + position * 0.05;
  
  // 决策逻辑
  
  // 非常强的手牌 - 加注或全押
  if (adjustedStrength >= 0.8) {
    if (availableActions.includes('raise')) {
      const minRaise = getMinRaiseAmount(state, playerIndex);
      // 强牌时加注更多
      const raiseMultiplier = 2 + Math.random() * 2;
      const raiseAmount = Math.min(
        Math.floor(state.currentBet + minRaise * raiseMultiplier),
        player.chips + player.currentBet
      );
      
      // 偶尔全押
      if (adjustedStrength >= 0.9 && Math.random() > 0.5) {
        return { action: 'all-in' };
      }
      
      return { action: 'raise', raiseAmount };
    }
    if (availableActions.includes('call')) {
      return { action: 'call' };
    }
    if (availableActions.includes('check')) {
      // 慢打
      if (Math.random() > 0.7) {
        return { action: 'check' };
      }
    }
  }
  
  // 较强的手牌
  if (adjustedStrength >= 0.6) {
    if (callAmount === 0 && availableActions.includes('check')) {
      // 有时加注，有时过牌
      if (Math.random() > 0.5 && availableActions.includes('raise')) {
        const minRaise = getMinRaiseAmount(state, playerIndex);
        return { action: 'raise', raiseAmount: state.currentBet + minRaise };
      }
      return { action: 'check' };
    }
    
    // 跟注如果底池赔率合适
    if (potOdds < adjustedStrength && availableActions.includes('call')) {
      return { action: 'call' };
    }
    
    // 偶尔诈唬加注
    if (Math.random() > 0.7 && availableActions.includes('raise')) {
      const minRaise = getMinRaiseAmount(state, playerIndex);
      return { action: 'raise', raiseAmount: state.currentBet + minRaise };
    }
    
    if (availableActions.includes('call') && callAmount < player.chips * 0.3) {
      return { action: 'call' };
    }
  }
  
  // 中等手牌
  if (adjustedStrength >= 0.4) {
    if (callAmount === 0 && availableActions.includes('check')) {
      return { action: 'check' };
    }
    
    // 小额跟注
    if (potOdds < adjustedStrength * 0.8 && availableActions.includes('call')) {
      if (callAmount < player.chips * 0.15) {
        return { action: 'call' };
      }
    }
    
    // 偶尔诈唬
    if (Math.random() > 0.85 && availableActions.includes('raise')) {
      const minRaise = getMinRaiseAmount(state, playerIndex);
      return { action: 'raise', raiseAmount: state.currentBet + minRaise };
    }
  }
  
  // 弱手牌
  if (callAmount === 0 && availableActions.includes('check')) {
    return { action: 'check' };
  }
  
  // 偶尔诈唬
  if (Math.random() > 0.92 && availableActions.includes('raise')) {
    const minRaise = getMinRaiseAmount(state, playerIndex);
    return { action: 'raise', raiseAmount: state.currentBet + minRaise };
  }
  
  // 非常小的跟注可以考虑
  if (callAmount <= state.bigBlindAmount && availableActions.includes('call') && Math.random() > 0.3) {
    return { action: 'call' };
  }
  
  // 默认弃牌
  return { action: 'fold' };
}

// 获取玩家位置评分 (0-1, 越后位越好)
function getPosition(state: GameState, playerIndex: number): number {
  const dealerIndex = state.dealerIndex;
  const numPlayers = state.players.length;
  
  // 计算相对于庄家的位置
  let distance = (playerIndex - dealerIndex + numPlayers) % numPlayers;
  
  return distance / (numPlayers - 1);
}

// 获取AI行动的延迟时间（毫秒）
export function getAIActionDelay(): number {
  return 800 + Math.random() * 700; // 800-1500ms
}
