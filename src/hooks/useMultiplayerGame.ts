import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, PlayerAction } from '../types';

export function useMultiplayerGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{id: number, name: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timerDuration, setTimerDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const processingRef = useRef(false);

  // 连接到WebSocket服务器
  const connectToServer = useCallback((serverUrl: string) => {
    // 如果已有连接且状态正常，先关闭旧连接
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket连接已建立');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('收到WebSocket消息:', message.type);
          
          switch (message.type) {
            case 'room-created':
              console.log('处理房间创建消息:', message);
              setRoomId(message.roomId);
              setPlayerId(message.playerId);
              setIsHost(true);
              if (message.players && Array.isArray(message.players)) {
                setPlayers(message.players);
              }
              break;
              
            case 'room-joined':
              console.log('处理房间加入消息:', message);
              setRoomId(message.roomId);
              setPlayerId(message.playerId);
              setIsHost(false);
              if (message.players && Array.isArray(message.players)) {
                setPlayers(message.players);
              }
              break;
              
            case 'player-joined':
              console.log('处理玩家加入消息:', message);
              // 如果消息包含完整的玩家列表，则使用完整列表
              if (message.players && Array.isArray(message.players)) {
                setPlayers(message.players);
              } else {
                // 否则，只添加新加入的玩家
                setPlayers(prev => {
                  // 检查玩家是否已经存在于列表中，避免重复添加
                  const playerExists = prev.some(p => p.id === message.playerId);
                  if (!playerExists) {
                    return [
                      ...prev,
                      { id: message.playerId, name: message.playerName }
                    ];
                  }
                  return prev;
                });
              }
              break;
              
            case 'player-left':
              console.log('处理玩家离开消息:', message);
              // 如果消息包含完整的玩家列表，则使用完整列表
              if (message.players && Array.isArray(message.players)) {
                setPlayers(message.players);
              } else {
                // 否则，从列表中移除离开的玩家
                setPlayers(prev => prev.filter(p => p.id !== message.playerId));
              }
              break;
              
            case 'game-started':
              console.log('收到游戏开始消息:', message.gameState);
              setGameState(message.gameState);
              break;
              
            case 'game-state-update':
              console.log('收到游戏状态更新:', message.gameState);
              setGameState(message.gameState);
              break;
              
            case 'available-actions':
              console.log('收到可用行动消息:', message);
              // 可用行动列表已在gameState中处理
              break;
              
            case 'error':
              console.log('收到错误消息:', message.message);
              setError(message.message);
              break;
          }
        } catch (error) {
          console.error('处理消息时出错:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        setError('连接服务器失败');
      };
    } catch (error) {
      console.error('连接服务器时出错:', error);
      setError('无法连接到服务器');
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setGameState(null);
    setRoomId(null);
    setPlayerId(null);
    setPlayers([]);
  }, []);

  // 创建房间
  const createRoom = useCallback((playerName: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create-room',
        playerName
      }));
    }
  }, []);

  // 加入房间
  const joinRoom = useCallback((roomId: string, playerName: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join-room',
        roomId,
        playerName
      }));
    }
  }, []);

  // 开始游戏
  const startGame = useCallback(() => {
    console.log('开始游戏 - isHost:', isHost, '连接状态:', wsRef.current?.readyState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isHost) {
      wsRef.current.send(JSON.stringify({
        type: 'start-game'
      }));
      console.log('开始游戏消息已发送');
    } else {
      console.log('无法发送开始游戏消息 - 连接未就绪或不是房主');
    }
  }, [isHost]);

  // 玩家行动
  const handlePlayerAction = useCallback((action: PlayerAction, raiseAmount?: number) => {
    if (!gameState || !playerId || gameState.currentPlayerIndex !== playerId || isProcessing) {
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsProcessing(true);
      processingRef.current = true;
      
      wsRef.current.send(JSON.stringify({
        type: 'player-action',
        playerId,
        action,
        raiseAmount
      }));
    }
  }, [gameState, playerId, isProcessing]);

  // 时间到自动弃牌
  const handleTimeUp = useCallback(() => {
    if (gameState && playerId !== null && gameState.currentPlayerIndex === playerId && !gameState.roundComplete) {
      handlePlayerAction('fold');
    }
  }, [gameState, playerId, handlePlayerAction]);

  // 获取可用行动
  const getAvailableActions = useCallback(() => {
    if (gameState && playerId !== null && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'get-available-actions',
        playerId
      }));
    }
  }, [gameState, playerId]);

  // 下一轮
  const nextRound = useCallback(() => {
    // 在多人游戏中，下一轮由服务器控制
    // 客户端只需要等待服务器发送新的游戏状态
  }, []);

  // 重新开始游戏
  const resetGame = useCallback(() => {
    // 在多人游戏中，重新开始由房主控制
    if (isHost && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      startGame();
    }
  }, [isHost, startGame]);

  // 清理连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    gameState,
    isConnected,
    isHost,
    playerId,
    roomId,
    players,
    isProcessing,
    timerDuration,
    setTimerDuration,
    error,
    connectToServer,
    disconnect,
    createRoom,
    joinRoom,
    startGame,
    handlePlayerAction,
    handleTimeUp,
    getAvailableActions,
    nextRound,
    resetGame
  };
}