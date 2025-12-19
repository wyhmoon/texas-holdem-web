import React from 'react';
import type { GameState } from '../types';
import { PlayerDisplay } from './PlayerDisplay';
import { Card } from './Card';
import './PokerTable.css';

interface PokerTableProps {
  gameState: GameState;
}

export const PokerTable: React.FC<PokerTableProps> = ({ gameState }) => {
  const { players, communityCards, pot, phase, currentPlayerIndex, winners, message } = gameState;
  
  // 玩家位置映射 (6人桌)
  const positions: Array<'bottom' | 'left' | 'top-left' | 'top' | 'top-right' | 'right'> = [
    'bottom',     // 人类玩家
    'left',       // AI 1
    'top-left',   // AI 2  
    'top',        // AI 3
    'top-right',  // AI 4
    'right'       // AI 5
  ];

  const getPhaseLabel = () => {
    const labels: Record<string, string> = {
      'waiting': '等待开始',
      'preflop': '翻牌前',
      'flop': '翻牌',
      'turn': '转牌',
      'river': '河牌',
      'showdown': '摊牌',
      'ended': '游戏结束'
    };
    return labels[phase] || phase;
  };

  const showAllCards = phase === 'showdown' || gameState.roundComplete;

  return (
    <div className="poker-table-container">
      <div className="poker-table">
        {/* 桌面装饰 */}
        <div className="table-felt">
          <div className="table-border"></div>
          
          {/* 游戏阶段和信息 */}
          <div className="table-center">
            <div className="phase-indicator">{getPhaseLabel()}</div>
            
            {/* 公共牌 */}
            <div className="community-cards">
              {communityCards.map((card, index) => (
                <Card key={index} card={card} />
              ))}
              {/* 占位符 */}
              {[...Array(5 - communityCards.length)].map((_, index) => (
                <div key={`placeholder-${index}`} className="card-placeholder"></div>
              ))}
            </div>
            
            {/* 底池 */}
            <div className="pot-display">
              <span className="pot-label">底池</span>
              <span className="pot-value">{pot}</span>
            </div>
          </div>

          {/* 消息显示 */}
          <div className="message-display">{message}</div>
        </div>

        {/* 玩家位置 */}
        {players.map((player, index) => (
          <div key={player.id} className={`player-position position-${positions[index]}`}>
            <PlayerDisplay
              player={player}
              isCurrentPlayer={currentPlayerIndex === index && !gameState.roundComplete}
              showCards={player.type === 'human' || showAllCards}
              isWinner={winners.includes(index)}
              position={positions[index]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
