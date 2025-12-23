import React from 'react';
import './RoomWaiting.css';

interface RoomWaitingProps {
  roomId: string;
  playerName: string;
  isHost: boolean;
  players?: Array<{id: number, name: string}>;
  onStartGame: () => void;
  onAddAIPlayer: () => void;
  onLeaveRoom: () => void;
}

export const RoomWaiting: React.FC<RoomWaitingProps> = ({
  roomId,
  playerName,
  isHost,
  players = [],
  onStartGame,
  onAddAIPlayer,
  onLeaveRoom
}) => {
  return (
    <div className="room-waiting-container">
      <div className="room-waiting-card">
        <h2>{isHost ? '房间已创建' : '已加入房间'}</h2>
        
        <div className="room-info-box">
          <div className="room-code-section">
            <span className="room-code-label">房间号</span>
            <div className="room-code-value">{roomId}</div>
            {isHost && (
              <p className="room-code-hint">告诉朋友这个房间号，他们就可以加入游戏</p>
            )}
          </div>
        </div>

        <div className="players-section">
          <h3>玩家列表</h3>
          <div className="player-list">
            {players.map((player) => (
              <div 
                key={player.id} 
                className={`player-item ${player.id === 0 ? 'host' : ''} ${player.name.includes('AI') ? 'ai' : ''}`}
              >
                <span className="player-icon">
                  {player.id === 0 ? '👑' : player.name.includes('AI') ? '🤖' : '👤'}
                </span>
                <span className="player-name">{player.name}</span>
                {player.id === 0 && <span className="player-role">房主</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="room-actions">
            <button 
              className="room-btn add-ai-btn"
              onClick={onAddAIPlayer}
            >
              添加AI玩家
            </button>
            <button 
              className="room-btn start-game-btn"
              onClick={onStartGame}
            >
              开始游戏
            </button>
            <button 
              className="room-btn leave-room-btn"
              onClick={onLeaveRoom}
            >
              离开房间
            </button>
          </div>
        )}

        {!isHost && (
          <div className="room-actions">
            <p className="waiting-message">等待房主开始游戏...</p>
            <button 
              className="room-btn leave-room-btn"
              onClick={onLeaveRoom}
            >
              离开房间
            </button>
          </div>
        )}

        <div className="connection-info">
          <p>💡 局域网玩家可以在其他设备上访问此游戏</p>
          <p className="ip-hint">请确保所有设备在同一WiFi网络下</p>
        </div>
      </div>
    </div>
  );
};
