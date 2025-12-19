import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, PlayerAction } from '../types';
import { 
  createInitialGameState, 
  startNewRound, 
  playerAction 
} from '../utils/gameLogic';
import { makeAIDecision, getAIActionDelay } from '../utils/aiPlayer';

export function useGame() {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [isProcessing, setIsProcessing] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60); // 默认60秒
  const processingRef = useRef(false);

  // 开始新一轮
  const startGame = useCallback(() => {
    console.log('Starting new game');
    setGameState(state => startNewRound(state));
  }, []);

  // 人类玩家行动
  const handlePlayerAction = useCallback((action: PlayerAction, raiseAmount?: number) => {
    if (gameState.currentPlayerIndex !== 0 || isProcessing) {
      return;
    }

    setGameState(state => playerAction(state, 0, action, raiseAmount));
  }, [gameState.currentPlayerIndex, isProcessing]);

  // 时间到自动弃牌
  const handleTimeUp = useCallback(() => {
    if (gameState.currentPlayerIndex === 0 && !gameState.roundComplete) {
      setGameState(state => playerAction(state, 0, 'fold'));
    }
  }, [gameState.currentPlayerIndex, gameState.roundComplete]);

  // AI玩家自动行动
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // 检查是否是AI回合且游戏正在进行
    if (
      currentPlayer?.type === 'ai' && 
      !gameState.roundComplete && 
      gameState.phase !== 'waiting' &&
      gameState.phase !== 'showdown' &&
      !currentPlayer.isFolded &&
      !currentPlayer.isAllIn &&
      !processingRef.current
    ) {
      processingRef.current = true;
      setIsProcessing(true);
      
      const delay = getAIActionDelay();
      
      const timeoutId = setTimeout(() => {
        setGameState(state => {
          const currentAI = state.players[state.currentPlayerIndex];
          
          // 再次检查状态
          if (
            currentAI?.type !== 'ai' ||
            state.roundComplete ||
            state.phase === 'waiting' ||
            state.phase === 'showdown' ||
            currentAI.isFolded ||
            currentAI.isAllIn
          ) {
            processingRef.current = false;
            setIsProcessing(false);
            return state;
          }
          
          const decision = makeAIDecision(state, state.currentPlayerIndex);
          const newState = playerAction(
            state, 
            state.currentPlayerIndex, 
            decision.action, 
            decision.raiseAmount
          );
          
          processingRef.current = false;
          setIsProcessing(false);
          
          return newState;
        });
      }, delay);
      
      return () => {
        clearTimeout(timeoutId);
        processingRef.current = false;
        setIsProcessing(false);
      };
    }
  }, [gameState.currentPlayerIndex, gameState.roundComplete, gameState.phase, gameState.actionCount]);

  // 下一轮
  const nextRound = useCallback(() => {
    if (gameState.roundComplete) {
      setGameState(state => startNewRound(state));
    }
  }, [gameState.roundComplete]);

  // 重新开始游戏
  const resetGame = useCallback(() => {
    setGameState(createInitialGameState());
  }, []);

  return {
    gameState,
    isProcessing,
    timerDuration,
    setTimerDuration,
    startGame,
    handlePlayerAction,
    handleTimeUp,
    nextRound,
    resetGame
  };
}
