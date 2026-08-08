import { useEffect, useState } from 'react';
import { getPhase, useMpStore } from '../../mpStore';
import type { MpPlayer, RoomPublic } from '../../mpStore';
import { useStore } from '../../store';
import { CELL_KEYS, DIFFICULTY_LABELS } from '../../types';
import BirdCard from '../BirdCard';
import GuessGrid from '../GuessGrid';
import SearchBox from '../SearchBox';

const MAX_GUESSES = 8;

function scoreText(
  room: RoomPublic,
  roundWins: Record<string, number>,
  selfToken: string,
): string {
  const me = roundWins[selfToken] ?? 0;
  const opponent = room.players.find((p) => p.token !== selfToken);
  const other = opponent ? (roundWins[opponent.token] ?? 0) : 0;
  return `${me} : ${other}`;
}

function OpponentStatus({ room, opponent }: { room: RoomPublic; opponent: MpPlayer }) {
  const progress = room.roundProgress?.[opponent.token];
  const status = progress?.done === 'won' ? '已猜中' : progress?.done === 'out' ? '已出局' : '猜测中';
  return (
    <span className="mp-panel-sub">
      {opponent.connected ? '🟢' : '🔴'} 已用 {progress?.count ?? 0}/{MAX_GUESSES} 次 · {status}
    </span>
  );
}

/** 局内 2 分钟倒计时（按服务端时钟校准） */
function Countdown() {
  const deadline = useMpStore((s) => s.roundDeadline);
  const offset = useMpStore((s) => s.clockOffset);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const remain = Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <span className={`mp-countdown${remain <= 30 ? ' urgent' : ''}`}>
      ⏱ {mm}:{ss}
    </span>
  );
}

export default function MpRoom() {
  const room = useMpStore((s) => s.room);
  const selfRole = useMpStore((s) => s.selfRole);
  const myGuesses = useMpStore((s) => s.myGuesses);
  const redacted = useMpStore((s) => s.redacted);
  const animatingRow = useMpStore((s) => s.animatingRow);
  const roundResult = useMpStore((s) => s.roundResult);
  const matchResult = useMpStore((s) => s.matchResult);
  const ready = useMpStore((s) => s.ready);
  const submitGuess = useMpStore((s) => s.submitGuess);
  const leaveRoom = useMpStore((s) => s.leaveRoom);
  const guestId = useStore((s) => s.guestId);
  const conservation = useStore((s) => s.conservation);
  const setView = useStore((s) => s.setView);
  const showToast = useStore((s) => s.showToast);

  if (!room) {
    return (
      <div className="mp-room">
        <p className="stats-hint">不在任何房间中</p>
        <div className="result-actions">
          <button className="btn" onClick={() => setView('lobby')}>
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  const phase = getPhase({ room, roundResult, matchResult });
  const me = room.players.find((p) => p.token === guestId);
  const isPlayer = selfRole === 'player';

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      showToast('房间码已复制');
    } catch {
      showToast('复制失败，请手动复制');
    }
  };

  const backToLobby = () => {
    leaveRoom();
    setView('lobby');
  };

  if (phase === 'waiting') {
    return (
      <div className="mp-room">
        <div className="mp-code-box">
          <span className="mp-code-label">房间码</span>
          <button className="mp-code" onClick={() => void copyCode()} title="点击复制">
            {room.code}
          </button>
          <span className="mp-code-hint">点击复制，发给好友加入</span>
        </div>
        <div className="mp-players">
          {room.players.map((p) => (
            <div className="mp-player-card" key={p.token}>
              <span className="mp-player-name">
                {p.name}
                {p.isHost && <span className="mp-badge">房主</span>}
                {p.token === guestId && <span className="mp-badge self">你</span>}
              </span>
              <span className="mp-player-status">
                {p.connected ? '🟢 在线' : '🔴 掉线'}
                {p.ready && ' · ✓ 已准备'}
              </span>
            </div>
          ))}
          {room.players.length < 2 && (
            <div className="mp-player-card empty">等待第二位玩家加入…</div>
          )}
        </div>
        {room.spectators.length > 0 && (
          <p className="mp-spectators">观战：{room.spectators.map((s) => s.name).join('、')}</p>
        )}
        <div className="result-actions">
          {isPlayer &&
            (me?.ready ? (
              <span className="result-hint">已准备，等待对方…</span>
            ) : (
              <button
                className="btn btn-primary"
                disabled={room.players.length < 2}
                title={room.players.length < 2 ? '需要两名玩家' : '双方都准备后自动开局'}
                onClick={ready}
              >
                准备
              </button>
            ))}
          {isPlayer && room.players.length < 2 && (
            <span className="result-hint">需要两名玩家，双方都准备后自动开局</span>
          )}
          <button className="btn" onClick={backToLobby}>
            离开房间
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'matchEnd' && matchResult) {
    const iWon = matchResult.winner === guestId;
    const banner =
      matchResult.reason === 'forfeit'
        ? iWon
          ? '对手掉线判负，你已获胜'
          : `${matchResult.winnerName} 获胜（对方掉线判负）`
        : iWon
          ? '🎉 你已获胜'
          : `${matchResult.winnerName} 获胜`;
    return (
      <div className="mp-room">
        <p className={`result-banner ${iWon ? 'won' : 'lost'}`}>{banner}</p>
        <p className="mp-final-score">
          最终比分 {isPlayer ? scoreText(room, matchResult.roundWins, guestId) : ''}
          {!isPlayer &&
            room.players
              .map((p) => `${p.name} ${matchResult.roundWins[p.token] ?? 0}`)
              .join(' : ')}
        </p>
        {room.lastAnswer && <BirdCard bird={room.lastAnswer} />}
        <div className="result-actions">
          <button className="btn btn-primary" onClick={backToLobby}>
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'roundEnd' && roundResult) {
    const banner =
      roundResult.winner === 'draw'
        ? roundResult.reason === 'timeout'
          ? '⏰ 时间到！本局流局，都未猜中'
          : '本局流局，都未猜中'
        : roundResult.winner === guestId
          ? '🎉 你赢下本局'
          : `${roundResult.winnerName} 赢下本局`;
    const myReady = me?.ready ?? false;
    return (
      <div className="mp-room">
        <p className={`result-banner ${roundResult.winner === guestId ? 'won' : 'lost'}`}>
          {banner}
        </p>
        <p className="mp-final-score">
          局分 {isPlayer ? scoreText(room, roundResult.roundWins, guestId) : ''}
          {!isPlayer &&
            room.players
              .map((p) => `${p.name} ${roundResult.roundWins[p.token] ?? 0}`)
              .join(' : ')}
        </p>
        <BirdCard bird={roundResult.answer} />
        <div className="result-actions">
          {isPlayer &&
            (myReady ? (
              <span className="result-hint">已准备，等待对方…</span>
            ) : (
              <button className="btn btn-primary" onClick={ready}>
                下一局准备
              </button>
            ))}
        </div>
      </div>
    );
  }

  // playing
  const myProgress = room.roundProgress?.[guestId];
  const myDone = !!myProgress?.done;
  const guessDisabled = !isPlayer || myDone;
  // 玩家视角：对手是另一个人；观战视角：双方都是“别人”
  const otherPlayers = room.players.filter((p) => p.token !== guestId);

  return (
    <div className="mp-room">
      <div className="mp-round-header">
        <span>
          第 {room.roundNumber} 局 / BO{room.config.bestOf} · {DIFFICULTY_LABELS[room.config.difficulty]}{' '}
          <Countdown />
        </span>
        <span className="mp-score">
          {isPlayer
            ? `局分 ${scoreText(room, room.roundWins, guestId)}`
            : room.players.map((p) => `${p.name} ${room.roundWins[p.token] ?? 0}`).join(' : ')}
        </span>
      </div>

      <div className="mp-boards">
        {isPlayer && (
          <div className="mp-panel">
            <div className="mp-compare">
              <div className="mp-mine">
                <div className="mp-panel-header">
                  <span className="mp-panel-title">你</span>
                  <span className="mp-panel-sub">
                    {myDone
                      ? myProgress?.done === 'won'
                        ? '已猜中，等待对手'
                        : '次数用完，等待对手'
                      : `剩余 ${MAX_GUESSES - myGuesses.length} 次`}
                  </span>
                </div>
                <SearchBox
                  disabled={guessDisabled}
                  difficulty={room.config.difficulty}
                  onSubmit={(bird) => submitGuess(bird.id)}
                />
                {myGuesses.length > 0 && (
                  <GuessGrid
                    guesses={myGuesses}
                    animatingRow={animatingRow}
                    conservation={conservation}
                  />
                )}
              </div>

              {otherPlayers.map((p) => (
                <div className="mp-opponent-col" key={p.token}>
                  <div className="mp-panel-header">
                    <span className="mp-panel-title">{p.name}</span>
                    <OpponentStatus room={room} opponent={p} />
                  </div>
                  <div className="redacted-grid">
                    {(redacted[p.token] ?? []).length === 0 && (
                      <span className="mp-panel-sub">还没有猜测</span>
                    )}
                    {(redacted[p.token] ?? []).map((row, i) => (
                      <div className="redacted-row" key={i}>
                        {CELL_KEYS.map((key) => (
                          <span
                            key={key}
                            className={`redacted-cell ${row.cells[key]?.feedback ?? 'gray'}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPlayer &&
          otherPlayers.map((p) => (
            <div className="mp-panel" key={p.token}>
              <div className="mp-panel-header">
                <span className="mp-panel-title">{p.name}</span>
                <OpponentStatus room={room} opponent={p} />
              </div>
              <div className="redacted-grid">
                {(redacted[p.token] ?? []).length === 0 && (
                  <span className="mp-panel-sub">还没有猜测</span>
                )}
                {(redacted[p.token] ?? []).map((row, i) => (
                  <div className="redacted-row" key={i}>
                    {CELL_KEYS.map((key) => (
                      <span
                        key={key}
                        className={`redacted-cell ${row.cells[key]?.feedback ?? 'gray'}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {room.spectators.length > 0 && (
        <p className="mp-spectators">观战：{room.spectators.map((s) => s.name).join('、')}</p>
      )}
      <div className="result-actions">
        <button className="btn btn-ghost" onClick={backToLobby}>
          离开房间
        </button>
      </div>
    </div>
  );
}
