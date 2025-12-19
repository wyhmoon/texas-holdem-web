
import { PokerTable } from './components/PokerTable';
import { ActionPanel } from './components/ActionPanel';
import { useGame } from './hooks/useGame';
import './App.css';

function App() {
  const { 
    gameState, 
    isProcessing, 
    startGame, 
    handlePlayerAction, 
    nextRound, 
    resetGame 
  } = useGame();

  const humanPlayer = gameState.players[0];
  const isGameOver = gameState.phase === 'ended' || humanPlayer.chips <= 0;
  const canStartNewRound = gameState.phase === 'waiting' || gameState.roundComplete;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克</h1>
        <div className="header-info">
          <span className="blind-info">盲注: {gameState.smallBlindAmount}/{gameState.bigBlindAmount}</span>
        </div>
      </header>

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
