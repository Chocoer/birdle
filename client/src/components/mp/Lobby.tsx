import { useEffect, useState } from 'react';
import { Loader2, LogIn, PlusCircle, Zap } from 'lucide-react';
import { MP_NAME_KEY, useMpStore } from '../../mpStore';
import { useStore } from '../../store';
import type { Difficulty } from '../../types';
import { DIFFICULTY_LABELS } from '../../types';

type LobbyMode = 'menu' | 'create' | 'match' | 'join';

function defaultName(): string {
  return `玩家${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function Lobby() {
  const createRoom = useMpStore((s) => s.createRoom);
  const joinRoom = useMpStore((s) => s.joinRoom);
  const joinQueue = useMpStore((s) => s.joinQueue);
  const leaveQueue = useMpStore((s) => s.leaveQueue);
  const queueStatus = useMpStore((s) => s.queueStatus);
  const connected = useMpStore((s) => s.connected);
  const setView = useStore((s) => s.setView);

  const [mode, setMode] = useState<LobbyMode>('menu');
  const [name, setName] = useState(() => localStorage.getItem(MP_NAME_KEY) ?? defaultName());
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [roomCode, setRoomCode] = useState('');
  const [queueDifficulty, setQueueDifficulty] = useState<Difficulty>('normal');
  const [queueBestOf, setQueueBestOf] = useState<3 | 5>(3);
  const [queueSeconds, setQueueSeconds] = useState(0);

  const playerName = name.trim() || defaultName();

  useEffect(() => {
    if (queueStatus !== 'queued') {
      setQueueSeconds(0);
      return;
    }
    const t = setInterval(() => setQueueSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [queueStatus]);

  const saveName = (value: string) => {
    setName(value);
    localStorage.setItem(MP_NAME_KEY, value.trim());
  };

  const difficultySelect = (value: Difficulty, onChange: (d: Difficulty) => void) => (
    <label className="lobby-label">
      难度
      <select
        className="lobby-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Difficulty)}
      >
        {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
          <option key={d} value={d}>
            {DIFFICULTY_LABELS[d]}
          </option>
        ))}
      </select>
    </label>
  );

  const bestOfSelect = (value: 3 | 5, onChange: (b: 3 | 5) => void) => (
    <label className="lobby-label">
      赛制
      <select
        className="lobby-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) === 5 ? 5 : 3)}
      >
        <option value={3}>BO3（三局两胜）</option>
        <option value={5}>BO5（五局三胜）</option>
      </select>
    </label>
  );

  const nameInput = (
    <section className="lobby-section">
      <label className="lobby-label">昵称</label>
      <input
        className="search-input"
        type="text"
        value={name}
        maxLength={16}
        placeholder="输入你的昵称"
        onChange={(e) => saveName(e.target.value)}
      />
    </section>
  );

  if (mode === 'create') {
    return (
      <div className="lobby">
        <h2 className="lobby-title">创建房间</h2>
        {nameInput}
        <section className="lobby-section">
          <div className="lobby-form">
            {difficultySelect(difficulty, setDifficulty)}
            {bestOfSelect(bestOf, setBestOf)}
            <button
              className="btn btn-primary"
              onClick={() => createRoom({ playerName, difficulty, bestOf })}
            >
              创建房间
            </button>
          </div>
        </section>
        <button className="btn" onClick={() => setMode('menu')}>
          返回
        </button>
      </div>
    );
  }

  if (mode === 'match') {
    return (
      <div className="lobby">
        <h2 className="lobby-title">快速匹配</h2>
        {nameInput}
        <section className="lobby-section">
          {queueStatus === 'queued' ? (
            <div className="lobby-queue-waiting">
              <p className="lobby-hint">
                <Loader2 size={14} className="spin" /> 正在匹配对手…（已等待 {queueSeconds} 秒）
              </p>
              <p className="lobby-hint">同难度同赛制优先，等待 30 秒后放宽条件</p>
              <button className="btn" onClick={leaveQueue}>
                取消匹配
              </button>
            </div>
          ) : (
            <div className="lobby-form">
              {difficultySelect(queueDifficulty, setQueueDifficulty)}
              {bestOfSelect(queueBestOf, setQueueBestOf)}
              <button
                className="btn btn-primary"
                disabled={!connected}
                onClick={() =>
                  joinQueue({ playerName, difficulty: queueDifficulty, bestOf: queueBestOf })
                }
              >
                开始匹配
              </button>
            </div>
          )}
        </section>
        <button className="btn" onClick={() => setMode('menu')}>
          返回
        </button>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="lobby">
        <h2 className="lobby-title">加入房间</h2>
        {nameInput}
        <section className="lobby-section">
          <div className="lobby-join">
            <input
              className="search-input lobby-code-input"
              type="text"
              value={roomCode}
              maxLength={5}
              placeholder="5 位房间码"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button
              className="btn btn-primary"
              disabled={roomCode.trim().length !== 5}
              onClick={() => joinRoom(roomCode.trim(), playerName)}
            >
              加入房间
            </button>
          </div>
        </section>
        <button className="btn" onClick={() => setMode('menu')}>
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="lobby">
      <h2 className="lobby-title">联机对战</h2>
      <p className="lobby-hint">{connected ? '已连接服务器' : '正在连接服务器…'}</p>
      {nameInput}
      {queueStatus === 'queued' && (
        <p className="lobby-hint">
          <Loader2 size={14} className="spin" /> 匹配进行中（已等待 {queueSeconds} 秒），
          <button className="btn btn-ghost lobby-goto-match" onClick={() => setMode('match')}>
            查看
          </button>
        </p>
      )}
      <div className="mode-cards lobby-mode-cards">
        <button className="mode-card" onClick={() => setMode('create')}>
          <span className="mode-card-icon">
            <PlusCircle size={34} strokeWidth={1.8} />
          </span>
          <span className="mode-card-name">创建房间</span>
          <span className="mode-card-desc">生成 5 位房间码，邀请好友加入</span>
        </button>
        <button className="mode-card" onClick={() => setMode('join')}>
          <span className="mode-card-icon">
            <LogIn size={34} strokeWidth={1.8} />
          </span>
          <span className="mode-card-name">加入房间</span>
          <span className="mode-card-desc">输入好友分享的房间码</span>
        </button>
        <button className="mode-card" disabled={!connected} onClick={() => setMode('match')}>
          <span className="mode-card-icon">
            <Zap size={34} strokeWidth={1.8} />
          </span>
          <span className="mode-card-name">快速匹配</span>
          <span className="mode-card-desc">自动为你寻找在线对手</span>
        </button>
      </div>
      <button className="btn" onClick={() => setView('home')}>
        返回首页
      </button>
    </div>
  );
}
