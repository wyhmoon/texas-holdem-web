import React, { useState } from 'react';
import './MultiplayerLobby.css';

interface MultiplayerLobbyProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onPlayOffline: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onCreateRoom,
  onJoinRoom,
  onPlayOffline
}) => {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName);
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && roomId.trim()) {
      onJoinRoom(roomId.toUpperCase(), playerName);
    }
  };

  if (mode === 'menu') {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <h1>🃏 德州扑克</h1>
          <div className="lobby-buttons">
            <button 
              className="lobby-btn create-btn"
              onClick={() => setMode('create')}
            >
              🏠 创建房间
            </button>
            <button 
              className="lobby-btn join-btn"
              onClick={() => setMode('join')}
            >
              🚪 加入房间
            </button>
            <button 
              className="lobby-btn offline-btn"
              onClick={onPlayOffline}
            >
              🎮 单机游戏
            </button>
          </div>
          <div className="lobby-info">
            <p>💡 提示：创建或加入房间后，局域网内的其他玩家可以一起游戏</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <h2>创建房间</h2>
          <div className="lobby-form">
            <input
              type="text"
              placeholder="输入你的昵称"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={10}
              className="lobby-input"
            />
            <button 
              className="lobby-btn create-btn"
              onClick={handleCreateRoom}
              disabled={!playerName.trim()}
            >
              创建房间
            </button>
            <button 
              className="lobby-btn back-btn"
              onClick={() => setMode('menu')}
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h2>加入房间</h2>
        <div className="lobby-form">
          <input
            type="text"
            placeholder="输入房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            maxLength={6}
            className="lobby-input"
          />
          <input
            type="text"
            placeholder="输入你的昵称"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={10}
            className="lobby-input"
          />
          <button 
            className="lobby-btn join-btn"
            onClick={handleJoinRoom}
            disabled={!playerName.trim() || !roomId.trim()}
          >
            加入房间
          </button>
          <button 
            className="lobby-btn back-btn"
            onClick={() => setMode('menu')}
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
};
