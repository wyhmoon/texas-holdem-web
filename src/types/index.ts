// 花色
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// 牌值
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// 单张牌
export interface Card {
  suit: Suit;
  rank: Rank;
}

// 玩家类型
export type PlayerType = 'human' | 'ai';

// 玩家动作
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

// 游戏阶段
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// 玩家状态
export interface Player {
  id: number;
  name: string;
  type: PlayerType;
  chips: number;
  cards: Card[];
  currentBet: number;
  totalBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActive: boolean;
  lastAction?: PlayerAction;
  handRank?: HandRank;
}

// 手牌等级
export type HandRankType = 
  | 'high-card'
  | 'one-pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface HandRank {
  type: HandRankType;
  rank: number;
  highCards: number[];
  name: string;
  cards: Card[];
}

// 游戏状态
export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindAmount: number;
  bigBlindAmount: number;
  deck: Card[];
  winners: number[];
  message: string;
  roundComplete: boolean;
  minRaise: number;
  lastRaiseAmount: number;
  actionCount: number;
}

// AI难度
export type AIDifficulty = 'easy' | 'medium' | 'hard';

// 花色符号映射
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

// 花色颜色映射
export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#2c3e50',
  spades: '#2c3e50'
};

// 牌值数字映射
export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 所有牌值
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// 所有花色
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
