import { useEffect, useState } from 'react';
import { MP_NAME_KEY, useMpStore } from '../../mpStore';
import { useStore } from '../../store';
import type { Difficulty } from '../../types';
import { DIFFICULTY_LABELS } from '../../types';

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

  return (
    <div className="lobby">
      <h2 className="lobby-title">联机对战</h2>
      <p className="lobby-hint">{connected ? '已连接服务器' : '正在连接服务器…'}</p>

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

      <section className="lobby-section">
        <h3 className="lobby-section-title">创建房间</h3>
        <div className="lobby-form">
          <label className="lobby-label">
            赛制
            <select
              className="lobby-select"
              value={bestOf}
              onChange={(e) => setBestOf(Number(e.target.value) === 5 ? 5 : 3)}
            >
              <option value={3}>BO3（三局两胜）</option>
              <option value={5}>BO5（五局三胜）</option>
            </select>
          </label>
          <label className="lobby-label">
            难度
            <select
              className="lobby-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            onClick={() => createRoom({ playerName, difficulty, bestOf })}
          >
            创建房间
          </button>
        </div>
      </section>

      <section className="lobby-section">
        <h3 className="lobby-section-title">快速匹配</h3>
        {queueStatus === 'queued' ? (
          <div className="lobby-queue-waiting">
            <p className="lobby-hint">🔍 正在匹配对手…（已等待 {queueSeconds} 秒）</p>
            <p className="lobby-hint">同难度同赛制优先，等待 30 秒后放宽条件</p>
            <button className="btn" onClick={leaveQueue}>
              取消匹配
            </button>
          </div>
        ) : (
          <div className="lobby-form">
            <label className="lobby-label">
              难度
              <select
                className="lobby-select"
                value={queueDifficulty}
                onChange={(e) => setQueueDifficulty(e.target.value as Difficulty)}
              >
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="lobby-label">
              赛制
              <select
                className="lobby-select"
                value={queueBestOf}
                onChange={(e) => setQueueBestOf(Number(e.target.value) === 5 ? 5 : 3)}
              >
                <option value={3}>BO3（三局两胜）</option>
                <option value={5}>BO5（五局三胜）</option>
              </select>
            </label>
            <button
              className="btn btn-primary"
              disabled={!connected}
              onClick={() => joinQueue({ playerName, difficulty: queueDifficulty, bestOf: queueBestOf })}
            >
              开始匹配
            </button>
          </div>
        )}
      </section>

      <section className="lobby-section">
        <h3 className="lobby-section-title">加入房间</h3>
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

      <button className="btn" onClick={() => setView('home')}>
        返回首页
      </button>
    </div>
  );
}
