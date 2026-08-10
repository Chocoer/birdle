import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { ApiError } from '../api';
import { useStore } from '../store';

const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: '用户名需 2-16 个字符，密码至少 8 位',
  username_taken: '这个用户名已经被注册了',
  wrong_credentials: '用户名或密码错误',
  rate_limited: '操作太频繁，请稍后再试',
};

/** 「我的」页顶部账号区：登录/注册或账号信息 */
export default function Account() {
  const user = useStore((s) => s.user);
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (tab === 'login') await login(username.trim(), password);
      else await register(username.trim(), password);
      showToast(tab === 'login' ? '登录成功' : '注册成功，战绩已绑定账号');
    } catch (e) {
      setError(e instanceof ApiError ? (ERROR_TEXT[e.code] ?? '操作失败，请稍后再试') : '网络异常');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="account-card">
        <span className="account-user">
          <UserRound size={18} /> {user}
        </span>
        <span className="settings-hint">战绩已绑定账号，换设备登录也能看到</span>
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void logout()
              .then(() => showToast('已退出登录'))
              .finally(() => setBusy(false));
          }}
        >
          <LogOut size={14} /> 退出登录
        </button>
      </div>
    );
  }

  return (
    <div className="account-card">
      <div className="account-tabs">
        <button
          className={tab === 'login' ? 'account-tab active' : 'account-tab'}
          onClick={() => {
            setTab('login');
            setError('');
          }}
        >
          登录
        </button>
        <button
          className={tab === 'register' ? 'account-tab active' : 'account-tab'}
          onClick={() => {
            setTab('register');
            setError('');
          }}
        >
          注册
        </button>
      </div>
      <input
        className="search-input"
        type="text"
        value={username}
        maxLength={16}
        placeholder="用户名（2-16 个字符）"
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="search-input"
        type="password"
        value={password}
        maxLength={72}
        placeholder="密码（至少 8 位）"
        autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
      />
      {error && <p className="account-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
        {tab === 'login' ? '登录' : '注册'}
      </button>
      <p className="settings-hint">登录后，当前浏览器的游客战绩会自动并入账号；不登录也能正常玩</p>
    </div>
  );
}
