import { useEffect } from 'react';
import Game from './components/Game';
import Home from './components/Home';
import Lobby from './components/mp/Lobby';
import MpRoom from './components/mp/MpRoom';
import Rules from './components/Rules';
import Settings from './components/Settings';
import Stats from './components/Stats';
import { useMpStore } from './mpStore';
import { useStore } from './store';

export default function App() {
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const game = useStore((s) => s.game);
  const toast = useStore((s) => s.toast);
  const setView = useStore((s) => s.setView);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const dismissToast = useStore((s) => s.dismissToast);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => useStore.getState().syncSystemTheme();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    useMpStore.getState().init();
  }, []);

  const goHome = () => {
    const mp = useMpStore.getState();
    if (mp.room) mp.leaveRoom();
    setView('home');
  };

  return (
    <div className="app">
      <header className="nav">
        <button className="nav-title" onClick={goHome}>
          🐦 鹬一把
        </button>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => setView('rules')}>
            规则
          </button>
          <button className="btn btn-ghost" onClick={() => setView('stats')}>
            统计
          </button>
          <button className="btn btn-ghost" onClick={() => setView('settings')}>
            设置
          </button>
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
            title={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="main">
        {view === 'game' && game ? (
          <Game />
        ) : view === 'stats' ? (
          <Stats />
        ) : view === 'settings' ? (
          <Settings />
        ) : view === 'rules' ? (
          <Rules />
        ) : view === 'lobby' ? (
          <Lobby />
        ) : view === 'mproom' ? (
          <MpRoom />
        ) : (
          <Home />
        )}
      </main>
      {toast && (
        <div className="toast" role="status" onClick={dismissToast}>
          {toast}
        </div>
      )}
    </div>
  );
}
