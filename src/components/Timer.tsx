import React, { useState, useEffect } from 'react';
import type { GameState } from '../types';
import './Timer.css';

interface TimerProps {
  gameState: GameState;
  isHumanTurn: boolean;
  onTimeUp: () => void;
  totalTime: number;
  setTotalTime: (time: number) => void;
}

export const Timer: React.FC<TimerProps> = ({
  gameState,
  isHumanTurn,
  onTimeUp,
  totalTime,
  setTotalTime
}) => {
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [showSettings, setShowSettings] = useState(false);

  // 重置倒计时当轮换时
  useEffect(() => {
    setTimeLeft(totalTime);
  }, [gameState.currentPlayerIndex, totalTime]);

  // 倒计时逻辑
  useEffect(() => {
    if (!isHumanTurn || gameState.roundComplete || gameState.phase === 'waiting') {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeUp();
          return totalTime;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHumanTurn, gameState.roundComplete, gameState.phase, onTimeUp, totalTime]);

  const percentage = (timeLeft / totalTime) * 100;
  const isWarning = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  const handleTimeChange = (newTime: number) => {
    if (newTime >= 10 && newTime <= 300) {
      setTotalTime(newTime);
      setTimeLeft(newTime);
      setShowSettings(false);
    }
  };

  if (gameState.phase === 'waiting') {
    return null;
  }

  return (
    <div className="timer-container">
      {showSettings ? (
        <div className="timer-settings">
          <h4>倒计时设置</h4>
          <div className="time-presets">
            {[30, 60, 90, 120].map(time => (
              <button
                key={time}
                className={`time-preset ${totalTime === time ? 'active' : ''}`}
                onClick={() => handleTimeChange(time)}
              >
                {time}秒
              </button>
            ))}
          </div>
          <div className="custom-time">
            <input
              type="number"
              min="10"
              max="300"
              value={totalTime}
              onChange={(e) => handleTimeChange(Number(e.target.value))}
              placeholder="自定义（10-300秒）"
            />
          </div>
          <button
            className="close-settings"
            onClick={() => setShowSettings(false)}
          >
            关闭
          </button>
        </div>
      ) : (
        <div className={`timer ${isHumanTurn ? 'active' : 'inactive'} ${isWarning ? 'warning' : ''} ${isCritical ? 'critical' : ''}`}>
          <button
            className="timer-settings-btn"
            onClick={() => setShowSettings(true)}
            title="点击设置倒计时"
          >
            ⚙️
          </button>
          
          <div className="timer-display">
            <div className="timer-circle">
              <svg className="timer-svg" viewBox="0 0 100 100">
                <circle
                  className="timer-bg"
                  cx="50"
                  cy="50"
                  r="45"
                />
                <circle
                  className="timer-progress"
                  cx="50"
                  cy="50"
                  r="45"
                  style={{
                    strokeDasharray: `${(percentage / 100) * 283} 283`
                  }}
                />
              </svg>
              <div className="timer-text">
                <span className="timer-number">{timeLeft}</span>
                <span className="timer-unit">秒</span>
              </div>
            </div>
          </div>

          {isHumanTurn && (
            <div className="timer-label">
              {isCritical ? '⏰ 时间紧张！' : isWarning ? '⚠️ 即将超时' : '⏱️ 操作倒计时'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
