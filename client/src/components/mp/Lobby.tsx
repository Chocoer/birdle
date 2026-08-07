import { useState } from 'react';
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
  const connected = useMpStore((s) => s.connected);
  const setView = useStore((s) => s.setView);

  const [name, setName] = useState(() => localStorage.getItem(MP_NAME_KEY) ?? defaultName());
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [roomCode, setRoomCode] = useState('');

  const playerName = name.trim() || defaultName();

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
