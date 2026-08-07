import { useEffect } from 'react';
import { useStore } from '../store';

const MAX_GUESSES = 8;

export default function Stats() {
  const stats = useStore((s) => s.stats);
  const statsLoading = useStore((s) => s.statsLoading);
  const loadStats = useStore((s) => s.loadStats);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (statsLoading && !stats) return <p className="stats-hint">加载中…</p>;
  if (!stats) return <p className="stats-hint">暂无统计数据，先去玩一局吧</p>;

  const winRate =
    stats.winRate <= 1 ? Math.round(stats.winRate * 100) : Math.round(stats.winRate);
  const counts = Array.from(
    { length: MAX_GUESSES },
    (_, i) => stats.guessDistribution[String(i + 1)] ?? 0,
  );
  const maxCount = Math.max(...counts, 0);

  return (
    <div className="stats">
      <h2 className="stats-title">统计</h2>
      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-value">{stats.played}</span>
          <span className="stat-label">已玩局数</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">胜率</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.currentStreak}</span>
          <span className="stat-label">当前连胜</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.maxStreak}</span>
          <span className="stat-label">最大连胜</span>
        </div>
      </div>
      <h3 className="stats-subtitle">猜测次数分布</h3>
      <div className="dist-chart">
        {counts.map((count, i) => (
          <div className="dist-row" key={i}>
            <span className="dist-label">{i + 1}</span>
            <div className="dist-track">
              <div
                className="dist-bar"
                style={{ width: maxCount > 0 ? `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%` : 0 }}
              >
                {count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
