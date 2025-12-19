
import { PokerTable } from './components/PokerTable';
import { ActionPanel } from './components/ActionPanel';
import { GameLog } from './components/GameLog';
import { Timer } from './components/Timer';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RoomWaiting } from './components/RoomWaiting';
import { useGame } from './hooks/useGame';
import { useState } from 'react';
import './App.css';

function App() {
  const [gameMode, setGameMode] = useState<'lobby' | 'waiting' | 'game'>('lobby');
  const [roomInfo, setRoomInfo] = useState<{ roomId: string; playerName: string } | null>(null);
  
  const { 
    gameState, 
    isProcessing, 
    timerDuration,
    setTimerDuration,
    startGame, 
    handlePlayerAction, 
    handleTimeUp,
    nextRound, 
    resetGame 
  } = useGame();

  const humanPlayer = gameState.players[0];
  const isGameOver = gameState.phase === 'ended' || humanPlayer.chips <= 0;
  const canStartNewRound = gameState.phase === 'waiting' || gameState.roundComplete;

  // 多人模式处理
  const handleCreateRoom = (playerName: string) => {
    // 生成房间号（6位大写字母和数字）
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomInfo({ roomId, playerName });
    setGameMode('waiting');
    console.log('创建房间:', roomId, playerName);
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    // TODO: 连接WebSocket加入房间
    console.log('加入房间:', roomId, playerName);
    setGameMode('game');
  };

  const handlePlayOffline = () => {
    setGameMode('game');
  };

  const handleStartGame = () => {
    setGameMode('game');
  };

  const handleLeaveRoom = () => {
    setRoomInfo(null);
    setGameMode('lobby');
  };

  // 显示大厅
  if (gameMode === 'lobby') {
    return (
      <MultiplayerLobby
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onPlayOffline={handlePlayOffline}
      />
    );
  }

  // 显示房间等待界面
  if (gameMode === 'waiting' && roomInfo) {
    return (
      <RoomWaiting
        roomId={roomInfo.roomId}
        playerName={roomInfo.playerName}
        onStartGame={handleStartGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克</h1>
        <div className="header-info">
          <span className="blind-info">盲注: {gameState.smallBlindAmount}/{gameState.bigBlindAmount}</span>
        </div>
      </header>

      <GameLog gameState={gameState} />
      <Timer 
        gameState={gameState}
        isHumanTurn={gameState.currentPlayerIndex === 0}
        onTimeUp={handleTimeUp}
        totalTime={timerDuration}
        setTotalTime={setTimerDuration}
      />

      <main className="app-main">
        <PokerTable gameState={gameState} />
        
        <div className="controls-section">
          {!isGameOver && (
            <>
              {canStartNewRound ? (
                <button 
                  className="control-btn start-btn"
                  onClick={gameState.phase === 'waiting' ? startGame : nextRound}
                >
                  {gameState.phase === 'waiting' ? '🎮 开始游戏' : '▶️ 下一轮'}
                </button>
              ) : (
                <ActionPanel 
                  gameState={gameState}
                  onAction={handlePlayerAction}
                  disabled={isProcessing || gameState.currentPlayerIndex !== 0}
                />
              )}
            </>
          )}
          
          {isGameOver && (
            <div className="game-over">
              <h2>游戏结束!</h2>
              <p>
                {humanPlayer.chips > 0 
                  ? `恭喜！你最终拥有 ${humanPlayer.chips} 筹码` 
                  : '你已经没有筹码了'
                }
              </p>
              <button className="control-btn reset-btn" onClick={resetGame}>
                🔄 重新开始
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>使用键盘快捷键: F-弃牌 | C-过牌/跟注 | R-加注</p>
      </footer>
    </div>
  );
}

export default App;
