import type { Card, HandRank, HandRankType } from '../types';
import { RANK_VALUES } from '../types';

// 手牌等级分数（用于比较）
const HAND_RANK_SCORES: Record<HandRankType, number> = {
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
const HAND_RANK_NAMES: Record<HandRankType, string> = {
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
function getCardValue(card: Card): number {
  return RANK_VALUES[card.rank];
}

// 按牌值分组
function groupByRank(cards: Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>();
  for (const card of cards) {
    const value = getCardValue(card);
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(card);
  }
  return groups;
}

// 按花色分组
function groupBySuit(cards: Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    if (!groups.has(card.suit)) {
      groups.set(card.suit, []);
    }
    groups.get(card.suit)!.push(card);
  }
  return groups;
}

// 检查是否为同花
function checkFlush(cards: Card[]): Card[] | null {
  const suitGroups = groupBySuit(cards);
  for (const [, suited] of suitGroups) {
    if (suited.length >= 5) {
      return suited.sort((a, b) => getCardValue(b) - getCardValue(a)).slice(0, 5);
    }
  }
  return null;
}

// 检查是否为顺子
function checkStraight(cards: Card[]): Card[] | null {
  const uniqueValues = [...new Set(cards.map(c => getCardValue(c)))].sort((a, b) => b - a);
  
  // 检查 A-2-3-4-5 (wheel)
  if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && 
      uniqueValues.includes(4) && uniqueValues.includes(5)) {
    const straightCards: Card[] = [];
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
      const straightCards: Card[] = [];
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
function checkStraightFlush(cards: Card[]): Card[] | null {
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
export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank {
  const allCards = [...holeCards, ...communityCards];
  
  if (allCards.length < 5) {
    // 如果牌不够，返回高牌
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
    const type: HandRankType = highCard === 14 ? 'royal-flush' : 'straight-flush';
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
    const fourCards = rankGroups.get(groupSizes[0].value)!;
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
    const threeCards = rankGroups.get(groupSizes[0].value)!;
    const pairCards = rankGroups.get(groupSizes[1].value)!.slice(0, 2);
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
    const threeCards = rankGroups.get(groupSizes[0].value)!;
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
    const pair1 = rankGroups.get(groupSizes[0].value)!;
    const pair2 = rankGroups.get(groupSizes[1].value)!;
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
    const pairCards = rankGroups.get(groupSizes[0].value)!;
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
export function compareHands(hand1: HandRank, hand2: HandRank): number {
  // 首先比较手牌类型等级
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }
  
  // 相同类型，比较高牌
  for (let i = 0; i < Math.min(hand1.highCards.length, hand2.highCards.length); i++) {
    if (hand1.highCards[i] !== hand2.highCards[i]) {
      return hand1.highCards[i] - hand2.highCards[i];
    }
  }
  
  return 0; // 完全相同
}

// 找出获胜者（返回获胜玩家的索引数组，可能有多个平局）
export function findWinners(hands: (HandRank | null)[]): number[] {
  let bestRank: HandRank | null = null;
  let winners: number[] = [];
  
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
