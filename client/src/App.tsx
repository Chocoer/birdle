import { useEffect } from 'react';
import { Bird, BookOpen, Moon, Sun, User, Volume2, VolumeX } from 'lucide-react';
import Backdrop from './components/Backdrop';
import Game from './components/Game';
import Home from './components/Home';
import Me from './components/Me';
import Lobby from './components/mp/Lobby';
import MpRoom from './components/mp/MpRoom';
import Rules from './components/Rules';
import { useMpStore } from './mpStore';
import { useStore } from './store';

export default function App() {
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);
  const game = useStore((s) => s.game);
  const toast = useStore((s) => s.toast);
  const setView = useStore((s) => s.setView);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);
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
    void useStore.getState().loadMe();
  }, []);

  const goHome = () => {
    const mp = useMpStore.getState();
    if (mp.room) mp.leaveRoom();
    setView('home');
  };

  return (
    <div className="app">
      <Backdrop />
      <header className="nav">
        <button className="nav-title" onClick={goHome}>
          <Bird size={22} strokeWidth={2.2} />
          鹬一把
        </button>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => setView('rules')} title="游戏规则">
            <BookOpen size={16} />
            <span className="nav-btn-text">规则</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setView('me')} title="我的战绩与设置">
            <User size={16} />
            <span className="nav-btn-text">我的</span>
          </button>
          <button
            className="btn btn-ghost"
            onClick={toggleSound}
            aria-label={soundOn ? '关闭环境音' : '开启环境音'}
            title={soundOn ? '关闭环境音' : '开启环境音'}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
            title={theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>
      <main className="main">
        {view === 'game' && game ? (
          <Game />
        ) : view === 'me' ? (
          <Me />
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
