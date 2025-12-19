import React from 'react';
import './RoomWaiting.css';

interface RoomWaitingProps {
  roomId: string;
  playerName: string;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const RoomWaiting: React.FC<RoomWaitingProps> = ({
  roomId,
  playerName,
  onStartGame,
  onLeaveRoom
}) => {
  return (
    <div className="room-waiting-container">
      <div className="room-waiting-card">
        <h2>房间已创建</h2>
        
        <div className="room-info-box">
          <div className="room-code-section">
            <span className="room-code-label">房间号</span>
            <div className="room-code-value">{roomId}</div>
            <p className="room-code-hint">告诉朋友这个房间号，他们就可以加入游戏</p>
          </div>
        </div>

        <div className="players-section">
          <h3>玩家列表</h3>
          <div className="player-list">
            <div className="player-item host">
              <span className="player-icon">👑</span>
              <span className="player-name">{playerName}</span>
              <span className="player-role">房主</span>
            </div>
            <div className="player-item waiting">
              <span className="player-icon">⏳</span>
              <span className="player-name">等待玩家加入...</span>
            </div>
          </div>
        </div>

        <div className="room-actions">
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

        <div className="connection-info">
          <p>💡 局域网玩家可以在其他设备上访问此游戏</p>
          <p className="ip-hint">请确保所有设备在同一WiFi网络下</p>
        </div>
      </div>
    </div>
  );
};
