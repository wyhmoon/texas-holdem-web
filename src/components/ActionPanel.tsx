import React, { useState } from 'react';
import type { GameState, PlayerAction } from '../types';
import { getAvailableActions, getCallAmount, getMinRaiseAmount } from '../utils/gameLogic';
import './ActionPanel.css';

interface ActionPanelProps {
  gameState: GameState;
  playerId?: number; // 多人游戏中人类玩家的ID
  onAction: (action: PlayerAction, raiseAmount?: number) => void;
  disabled: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ 
  gameState, 
  playerId = 0, // 默认为单机游戏的玩家0
  onAction, 
  disabled 
}) => {
  const humanPlayer = gameState.players[playerId];
  const isHumanTurn = gameState.currentPlayerIndex === playerId && !disabled;
  const availableActions = getAvailableActions(gameState, playerId);
  
  const callAmount = getCallAmount(gameState, playerId);
  const minRaiseAmount = getMinRaiseAmount(gameState, playerId);
  const maxRaise = humanPlayer.chips + humanPlayer.currentBet;
  
  const [raiseAmount, setRaiseAmount] = useState(
    Math.min(gameState.currentBet + minRaiseAmount, maxRaise)
  );

  // 更新加注金额当游戏状态改变时
  React.useEffect(() => {
    const newMinRaise = Math.min(gameState.currentBet + minRaiseAmount, maxRaise);
    setRaiseAmount(newMinRaise);
  }, [gameState.currentBet, minRaiseAmount, maxRaise]);

  const handleRaise = () => {
    onAction('raise', raiseAmount);
  };

  const adjustRaise = (multiplier: number) => {
    const potBasedRaise = Math.floor(gameState.pot * multiplier);
    const newAmount = Math.max(
      gameState.currentBet + minRaiseAmount,
      Math.min(potBasedRaise + gameState.currentBet, maxRaise)
    );
    setRaiseAmount(newAmount);
  };

  if (!isHumanTurn) {
    return (
      <div className="action-panel disabled">
        <div className="waiting-message">
          {gameState.phase === 'waiting' ? '点击"开始游戏"' : 
           gameState.roundComplete ? '本轮结束' :
           `等待 ${gameState.players[gameState.currentPlayerIndex]?.name || ''} 行动...`}
        </div>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <div className="action-info">
        <div className="pot-info">
          底池: <span className="pot-amount">{gameState.pot}</span>
        </div>
        <div className="current-bet-info">
          当前注: <span className="bet-amount">{gameState.currentBet}</span>
        </div>
        <div className="your-bet-info">
          你的下注: <span className="bet-amount">{humanPlayer.currentBet}</span>
        </div>
      </div>

      <div className="action-buttons">
        {availableActions.includes('fold') && (
          <button 
            className="action-btn fold-btn"
            onClick={() => onAction('fold')}
          >
            弃牌
          </button>
        )}

        {availableActions.includes('check') && (
          <button 
            className="action-btn check-btn"
            onClick={() => onAction('check')}
          >
            过牌
          </button>
        )}

        {availableActions.includes('call') && (
          <button 
            className="action-btn call-btn"
            onClick={() => onAction('call')}
          >
            跟注 {callAmount}
          </button>
        )}

        {availableActions.includes('all-in') && (
          <button 
            className="action-btn allin-btn"
            onClick={() => onAction('all-in')}
          >
            全押 {humanPlayer.chips}
          </button>
        )}
      </div>

      {availableActions.includes('raise') && (
        <div className="raise-section">
          <div className="raise-presets">
            <button onClick={() => adjustRaise(0.5)}>1/2 底池</button>
            <button onClick={() => adjustRaise(0.75)}>3/4 底池</button>
            <button onClick={() => adjustRaise(1)}>底池</button>
            <button onClick={() => setRaiseAmount(maxRaise)}>最大</button>
          </div>
          
          <div className="raise-slider-container">
            <input
              type="range"
              min={gameState.currentBet + minRaiseAmount}
              max={maxRaise}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="raise-slider"
            />
            <div className="raise-amount-display">
              <input
                type="number"
                value={raiseAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= gameState.currentBet + minRaiseAmount && val <= maxRaise) {
                    setRaiseAmount(val);
                  }
                }}
                min={gameState.currentBet + minRaiseAmount}
                max={maxRaise}
                className="raise-input"
              />
            </div>
          </div>

          <button 
            className="action-btn raise-btn"
            onClick={handleRaise}
          >
            加注到 {raiseAmount}
          </button>
        </div>
      )}
    </div>
  );
};
