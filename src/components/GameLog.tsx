import React, { useState, useEffect, useRef } from 'react';
import type { GameState } from '../types';
import './GameLog.css';

interface GameLogProps {
  gameState: GameState;
}

interface LogEntry {
  playerName: string;
  action: string;
  timestamp: string;
  playerId: number;
  actionType: string;
}

export const GameLog: React.FC<GameLogProps> = ({ gameState }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const prevPhaseRef = useRef(gameState.phase);
  
  // 监听游戏状态变化，添加日志
  useEffect(() => {
    // 调试日志
    console.log('GameLog useEffect triggered:', {
      phase: gameState.phase,
      prevPhase: prevPhaseRef.current,
      logsLength: logs.length
    });
    
    // 检查是否开始新一轮游戏（等待->翻牌前 或 展示->等待）
    if ((gameState.phase === 'preflop' && prevPhaseRef.current === 'waiting') ||
        (gameState.phase === 'preflop' && prevPhaseRef.current === 'showdown') ||
        (gameState.phase === 'waiting' && prevPhaseRef.current === 'showdown')) {
      console.log('Clearing logs for new round');
      // 清空日志
      setLogs([]);
    }
    
    prevPhaseRef.current = gameState.phase;
    
    // 添加新的操作日志
    const newLogs: LogEntry[] = [];
    gameState.players.forEach(player => {
      if (player.lastAction) {
        const actionLabels: Record<string, string> = {
          'fold': `弃牌`,
          'check': `过牌`,
          'call': `跟注 ${player.currentBet}`,
          'raise': `加注到 ${player.currentBet}`,
          'all-in': `全押 ${player.currentBet}`
        };
        
        const logEntry: LogEntry = {
          playerName: player.name,
          action: actionLabels[player.lastAction] || player.lastAction,
          timestamp: new Date().toLocaleTimeString('zh-CN'),
          playerId: player.id,
          actionType: player.lastAction
        };
        
        // 检查是否已经存在相同的日志（避免重复）
        const exists = logs.some(log => 
          log.playerId === logEntry.playerId && 
          log.actionType === logEntry.actionType &&
          log.timestamp === logEntry.timestamp
        );
        
        if (!exists) {
          newLogs.push(logEntry);
        }
      }
    });
    
    if (newLogs.length > 0) {
      setLogs(prev => [...prev, ...newLogs]);
    }
  }, [gameState.players, gameState.phase]);

  if (!isOpen) {
    return (
      <button className="log-toggle-btn" onClick={() => setIsOpen(true)}>
        📋
      </button>
    );
  }

  return (
    <div className="game-log">
      <div className="log-header">
        <h3>游戏日志</h3>
        <button className="log-close-btn" onClick={() => setIsOpen(false)}>
          ✕
        </button>
      </div>
      
      <div className="log-content">
        {logs.length === 0 ? (
          <div className="log-empty">暂无操作记录</div>
        ) : (
          [...logs].reverse().map((log, index) => (
            <div key={index} className="log-entry">
              <span className={`log-player player-${log.playerId}`}>{log.playerName}</span>
              <span className={`log-action action-${log.actionType}`}>{log.action}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
