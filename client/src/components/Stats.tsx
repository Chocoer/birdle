import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useStore } from '../store';
import type { Difficulty } from '../types';
import { DIFFICULTY_LABELS } from '../types';

const MAX_GUESSES = 8;

const METRIC_HINTS: Record<string, string> = {
  played: '完成的总局数',
  winRate: '猜中的局数占比',
  currentStreak: '连续猜中的局数',
  maxStreak: '历史最长连胜',
};

export default function Stats() {
  const stats = useStore((s) => s.stats);
  const statsLoading = useStore((s) => s.statsLoading);
  const loadStats = useStore((s) => s.loadStats);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (statsLoading && !stats) return <p className="stats-hint">加载中…</p>;
  if (!stats || stats.played === 0) {
    return (
      <div className="stats">
        <h2 className="stats-title">我的战绩</h2>
        <p className="settings-hint">仅统计单人游戏</p>
        <p className="stats-hint">还没有战绩，去玩一局单人游戏再来吧</p>
      </div>
    );
  }

  const winRate =
    stats.winRate <= 1 ? Math.round(stats.winRate * 100) : Math.round(stats.winRate);
  const counts = Array.from(
    { length: MAX_GUESSES },
    (_, i) => stats.guessDistribution[String(i + 1)] ?? 0,
  );
  const maxCount = Math.max(...counts, 0);

  return (
    <div className="stats">
      <h2 className="stats-title">我的战绩</h2>
      <p className="settings-hint">仅统计单人游戏</p>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-value">{stats.played}</span>
          <span className="stat-label">已玩局数</span>
          <span className="stat-hint">{METRIC_HINTS.played}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">胜率</span>
          <span className="stat-hint">{METRIC_HINTS.winRate}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.currentStreak}</span>
          <span className="stat-label">当前连胜</span>
          <span className="stat-hint">{METRIC_HINTS.currentStreak}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.maxStreak}</span>
          <span className="stat-label">最大连胜</span>
          <span className="stat-hint">{METRIC_HINTS.maxStreak}</span>
        </div>
      </div>

      <h3 className="stats-subtitle">猜中用了几次</h3>
      <p className="settings-hint">每根条表示：在第 N 次猜测时猜中的局数</p>
      <div className="dist-chart">
        {counts.map((count, i) => (
          <div className="dist-row" key={i}>
            <span className="dist-label">第{i + 1}次</span>
            <div className="dist-track">
              <div
                className="dist-bar"
                style={{ width: maxCount > 0 ? `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%` : 0 }}
              >
                {count > 0 ? count : ''}
              </div>
              {count === 0 && <span className="dist-zero">0</span>}
            </div>
          </div>
        ))}
      </div>

      {stats.recentGames.length > 0 && (
        <>
          <h3 className="stats-subtitle">最近战绩</h3>
          <ul className="recent-games">
            {stats.recentGames.map((g, i) => (
              <li className="recent-game" key={i}>
                <span className={`recent-result ${g.won ? 'won' : 'lost'}`}>
                  {g.won ? <Check size={13} /> : <X size={13} />}
                </span>
                <span className="recent-summary">
                  {g.won ? `第 ${g.guessCount} 次猜中` : '未猜中'}
                </span>
                <span className="recent-diff">
                  {DIFFICULTY_LABELS[g.difficulty as Difficulty] ?? g.difficulty}
                </span>
                <span className="recent-date">{g.date}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
