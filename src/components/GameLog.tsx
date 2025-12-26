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
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
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

  // 备用复制方法（用于非 HTTPS 环境）
  const fallbackCopyToClipboard = (text: string): boolean => {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // 避免滚动
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error('备用复制方法失败:', err);
    }

    document.body.removeChild(textArea);
    return success;
  };

  // 一键复制日志功能
  const handleCopyLogs = async () => {
    // 构建日志文本
    const logText = logs.map(log =>
      `[${log.timestamp}] ${log.playerName}: ${log.action}`
    ).join('\n');

    // 构建游戏状态快照
    const stateSnapshot = {
      phase: gameState.phase,
      pot: gameState.pot,
      currentBet: gameState.currentBet,
      currentPlayerIndex: gameState.currentPlayerIndex,
      communityCards: gameState.communityCards.map(c => `${c.rank}${c.suit}`),
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        currentBet: p.currentBet,
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
        lastAction: p.lastAction,
        cards: p.cards.map(c => `${c.rank}${c.suit}`),
        handRank: p.handRank?.name
      })),
      winners: gameState.winners,
      message: gameState.message
    };

    // 组合完整的调试信息
    const debugInfo = `
========== 德州扑克游戏日志 ==========
时间: ${new Date().toLocaleString('zh-CN')}

---------- 操作日志 ----------
${logText || '(无操作记录)'}

---------- 游戏状态快照 ----------
${JSON.stringify(stateSnapshot, null, 2)}
========================================
`;

    // 尝试使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(debugInfo);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
        return;
      } catch (error) {
        console.error('Clipboard API 复制失败，尝试备用方法:', error);
      }
    }

    // 使用备用复制方法
    const success = fallbackCopyToClipboard(debugInfo);
    if (success) {
      setCopyStatus('copied');
    } else {
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

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
        <div className="log-header-actions">
          <button
            className={`log-copy-btn ${copyStatus}`}
            onClick={handleCopyLogs}
            title="复制日志用于排查问题"
          >
            {copyStatus === 'copied' ? '✓ 已复制' : copyStatus === 'error' ? '✕ 失败' : '📋 复制'}
          </button>
          <button className="log-close-btn" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </div>
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
