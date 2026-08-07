import { useState } from 'react';
import { useStore } from '../store';

export default function Home() {
  const starting = useStore((s) => s.starting);
  const startGame = useStore((s) => s.startGame);
  const setView = useStore((s) => s.setView);
  const [mode, setMode] = useState<'menu' | 'single'>('menu');

  if (mode === 'single') {
    return (
      <div className="home">
        <h1 className="home-title">单人游戏</h1>
        <p className="home-subtitle">选择难度</p>
        <div className="mode-cards">
          <button className="mode-card" disabled={starting} onClick={() => void startGame('easy')}>
            <span className="mode-card-icon">🐣</span>
            <span className="mode-card-name">简单</span>
            <span className="mode-card-desc">100 种北京常见鸟，适合所有人</span>
          </button>
          <button className="mode-card" disabled={starting} onClick={() => void startGame('normal')}>
            <span className="mode-card-icon">🐦</span>
            <span className="mode-card-name">普通</span>
            <span className="mode-card-desc">200 种，适合观鸟入门者</span>
          </button>
          <button className="mode-card" disabled={starting} onClick={() => void startGame('hard')}>
            <span className="mode-card-icon">🦅</span>
            <span className="mode-card-name">困难</span>
            <span className="mode-card-desc">全部 435 种，北京观鸟爱好者挑战</span>
          </button>
        </div>
        {starting && <p className="home-hint">正在开局…</p>}
        <div className="result-actions">
          <button className="btn" onClick={() => setMode('menu')}>
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <h1 className="home-title">鹬一把</h1>
      <p className="home-subtitle">猜北京鸟类小游戏</p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => setMode('single')}>
          <span className="mode-card-icon">🐦</span>
          <span className="mode-card-name">单人游戏</span>
          <span className="mode-card-desc">三档难度，独自挑战猜鸟</span>
        </button>
        <button className="mode-card" onClick={() => setView('lobby')}>
          <span className="mode-card-icon">🆚</span>
          <span className="mode-card-name">联机对战</span>
          <span className="mode-card-desc">房间码组队，BO3/BO5 同题竞速</span>
        </button>
      </div>
    </div>
  );
}
