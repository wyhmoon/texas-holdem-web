import React from 'react';
import type { Player } from '../types';
import { Card } from './Card';
import './PlayerDisplay.css';

interface PlayerDisplayProps {
  player: Player;
  isCurrentPlayer: boolean;
  showCards: boolean;
  isWinner: boolean;
  position: 'top' | 'left' | 'right' | 'bottom' | 'top-left' | 'top-right';
}

export const PlayerDisplay: React.FC<PlayerDisplayProps> = ({
  player,
  isCurrentPlayer,
  showCards,
  isWinner,
  position
}) => {
  const getActionLabel = () => {
    if (!player.lastAction) return null;
    const labels: Record<string, string> = {
      'fold': '弃牌',
      'check': '过牌',
      'call': '跟注',
      'raise': '加注',
      'all-in': '全押'
    };
    return labels[player.lastAction] || player.lastAction;
  };

  const getPositionLabel = () => {
    const labels = [];
    if (player.isDealer) labels.push('D');
    if (player.isSmallBlind) labels.push('SB');
    if (player.isBigBlind) labels.push('BB');
    return labels.join(' / ');
  };

  return (
    <div 
      className={`player-display position-${position} ${isCurrentPlayer ? 'current-player' : ''} ${player.isFolded ? 'folded' : ''} ${isWinner ? 'winner' : ''} ${player.isAllIn ? 'all-in' : ''}`}
    >
      <div className="player-info">
        <div className="player-name">
          {player.name}
          {getPositionLabel() && <span className="position-badge">{getPositionLabel()}</span>}
        </div>
        <div className="player-chips">
          💰 {player.chips}
        </div>
        {player.currentBet > 0 && (
          <div className="player-bet">
            下注: {player.currentBet}
          </div>
        )}
        {getActionLabel() && (
          <div className={`player-action action-${player.lastAction}`}>
            {getActionLabel()}
          </div>
        )}
        {player.isAllIn && (
          <div className="all-in-badge">ALL IN</div>
        )}
        {player.handRank && showCards && (
          <div className="hand-rank">{player.handRank.name}</div>
        )}
      </div>
      
      <div className="player-cards">
        {player.cards.length > 0 ? (
          <>
            <Card 
              card={player.cards[0]} 
              hidden={!showCards && player.type === 'ai'} 
              small 
            />
            <Card 
              card={player.cards[1]} 
              hidden={!showCards && player.type === 'ai'} 
              small 
            />
          </>
        ) : (
          <div className="no-cards"></div>
        )}
      </div>
      
      {isWinner && <div className="winner-crown">👑</div>}
    </div>
  );
};
