
import { PokerTable } from './components/PokerTable';
import { ActionPanel } from './components/ActionPanel';
import { GameLog } from './components/GameLog';
import { Timer } from './components/Timer';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { RoomWaiting } from './components/RoomWaiting';
import { useGame } from './hooks/useGame';
import { useMultiplayerGame } from './hooks/useMultiplayerGame';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [gameMode, setGameMode] = useState<'lobby' | 'waiting' | 'game'>('lobby');
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  
  // 单机游戏hook
  const singlePlayerGame = useGame();
  
  // 多人游戏hook
  const multiplayerGame = useMultiplayerGame();
  
  // 根据游戏模式选择使用的hook
  const game = isMultiplayer ? multiplayerGame : singlePlayerGame;
  const { gameState, isProcessing, timerDuration, setTimerDuration } = game;

  // 多人游戏相关状态
  const [roomInfo, setRoomInfo] = useState<{ roomId: string; playerName: string } | null>(null);
  
  // 连接WebSocket服务器
  useEffect(() => {
    if (isMultiplayer && !multiplayerGame.isConnected) {
      // 连接到本地服务器
      multiplayerGame.connectToServer('ws://localhost:3001');
    }
    
    return () => {
      // 只在非多人游戏模式下断开连接，避免在房间内意外断开
      if (!isMultiplayer && multiplayerGame.isConnected) {
        multiplayerGame.disconnect();
      }
    };
  }, [isMultiplayer, multiplayerGame]);

  // 处理房间信息变化
  useEffect(() => {
    if (multiplayerGame.roomId && isMultiplayer && gameMode !== 'game') { // 添加条件，确保在游戏模式下不切换
      setRoomInfo({ 
        roomId: multiplayerGame.roomId, 
        playerName: multiplayerGame.players.find(p => p.id === multiplayerGame.playerId)?.name || '玩家' 
      });
      
      // 如果是房主且房间已创建，则进入等待界面
      if (multiplayerGame.isHost) {
        setGameMode('waiting');
      } else if (multiplayerGame.playerId !== null) {
        // 如果是加入房间的玩家，也需要进入等待界面
        setGameMode('waiting');
      }
    }
  }, [multiplayerGame.roomId, multiplayerGame.isHost, multiplayerGame.playerId, multiplayerGame.players, isMultiplayer, gameMode]); // 添加 gameMode 作为依赖

  // 处理游戏状态变化
  useEffect(() => {
    console.log('游戏状态变化检测:', { isMultiplayer, hasGameState: !!gameState, gameState });
    if (isMultiplayer && gameState) {
      console.log('切换到游戏模式');
      setGameMode('game');
    }
  }, [isMultiplayer, gameState]);

  const humanPlayer = gameState?.players[game.playerId || 0] || 
                    (gameState?.players[0] || { chips: 0 });
                    
  const isGameOver = gameState ? 
    (gameState.phase === 'ended' || humanPlayer.chips <= 0) : 
    false;
    
  const canStartNewRound = gameState ? 
    (gameState.phase === 'waiting' || gameState.roundComplete) : 
    false;

  // 多人模式处理
  const handleCreateRoom = (playerName: string) => {
    multiplayerGame.createRoom(playerName);
    // 只有在未连接时才设置多人游戏模式
    if (!multiplayerGame.isConnected) {
      setIsMultiplayer(true);
    }
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    multiplayerGame.joinRoom(roomId, playerName);
    // 只有在未连接时才设置多人游戏模式
    if (!multiplayerGame.isConnected) {
      setIsMultiplayer(true);
    }
  };

  const handlePlayOffline = () => {
    setGameMode('game');
    setIsMultiplayer(false);
  };

  const handleStartGame = () => {
    if (isMultiplayer) {
      multiplayerGame.startGame();
    } else {
      singlePlayerGame.startGame();
    }
  };

  const handleLeaveRoom = () => {
    if (isMultiplayer) {
      multiplayerGame.disconnect();
    }
    setRoomInfo(null);
    setGameMode('lobby');
    setIsMultiplayer(false);
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

  // 添加AI玩家
  const handleAddAIPlayer = () => {
    if (isMultiplayer) {
      multiplayerGame.addAIPlayer();
    }
  };

  // 显示房间等待界面
  if (gameMode === 'waiting' && roomInfo) {
    return (
      <RoomWaiting
        roomId={roomInfo.roomId}
        playerName={roomInfo.playerName}
        isHost={multiplayerGame.isHost}
        players={multiplayerGame.players.length > 0 ? 
          multiplayerGame.players : 
          [{ id: multiplayerGame.playerId || 0, name: roomInfo.playerName }]}
        onStartGame={handleStartGame}
        onAddAIPlayer={handleAddAIPlayer}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克</h1>
        {gameState && (
          <div className="header-info">
            <span className="blind-info">盲注: {gameState.smallBlindAmount}/{gameState.bigBlindAmount}</span>
            {isMultiplayer && multiplayerGame.roomId && (
              <span className="room-info">房间: {multiplayerGame.roomId}</span>
            )}
          </div>
        )}
      </header>

      {gameState && <GameLog gameState={gameState} />}
      {gameState && (
        <Timer 
          gameState={gameState}
          isHumanTurn={gameState.currentPlayerIndex === (isMultiplayer ? multiplayerGame.playerId : 0)}
          onTimeUp={isMultiplayer ? multiplayerGame.handleTimeUp : singlePlayerGame.handleTimeUp}
          totalTime={timerDuration}
          setTotalTime={setTimerDuration}
        />
      )}

      <main className="app-main">
        {gameState && <PokerTable gameState={gameState} />}
        
        <div className="controls-section">
          {gameState && !isGameOver && (
            <>
              {canStartNewRound ? (
                <button 
                  className="control-btn start-btn"
                  onClick={gameState.phase === 'waiting' ? handleStartGame : 
                           (isMultiplayer ? multiplayerGame.nextRound : singlePlayerGame.nextRound)}
                >
                  {gameState.phase === 'waiting' ? '🎮 开始游戏' : '▶️ 下一轮'}
                </button>
              ) : (
                <ActionPanel 
                  gameState={gameState}
                  playerId={isMultiplayer ? multiplayerGame.playerId : 0}
                  onAction={isMultiplayer ? multiplayerGame.handlePlayerAction : singlePlayerGame.handlePlayerAction}
                  disabled={isProcessing || 
                           gameState.currentPlayerIndex !== (isMultiplayer ? multiplayerGame.playerId : 0)}
                />
              )}
              {gameState && isMultiplayer && console.log('当前玩家ID:', multiplayerGame.playerId, '当前行动玩家索引:', gameState.currentPlayerIndex, '是否为当前玩家:', gameState.currentPlayerIndex === multiplayerGame.playerId)}
            </>
          )}
          
          {gameState && isGameOver && (
            <div className="game-over">
              <h2>游戏结束!</h2>
              <p>
                {humanPlayer.chips > 0 
                  ? `恭喜！你最终拥有 ${humanPlayer.chips} 筹码` 
                  : '你已经没有筹码了'
                }
              </p>
              <button 
                className="control-btn reset-btn" 
                onClick={isMultiplayer ? multiplayerGame.resetGame : singlePlayerGame.resetGame}
              >
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
