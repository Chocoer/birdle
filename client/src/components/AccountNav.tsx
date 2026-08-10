import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useStore } from '../store';
import AuthPanel from './AuthPanel';

/** 导航栏最右侧的账号入口：未登录弹登录/注册窗，已登录弹账号菜单 */
export default function AccountNav() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <div className="account-nav">
        <button className="btn btn-ghost account-nav-btn" onClick={() => setShowMenu((v) => !v)}>
          <UserRound size={16} />
          <span className="nav-btn-text">{user}</span>
        </button>
        {showMenu && (
          <>
            <div className="account-menu-backdrop" onClick={() => setShowMenu(false)} />
            <div className="account-menu">
              <button
                className="btn btn-ghost account-menu-item"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void logout()
                    .then(() => showToast('已退出登录'))
                    .finally(() => {
                      setBusy(false);
                      setShowMenu(false);
                    });
                }}
              >
                <LogOut size={14} /> 退出登录
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="account-nav">
      <button className="btn btn-ghost account-nav-btn" onClick={() => setShowAuth(true)}>
        <UserRound size={16} />
        <span className="nav-btn-text">登录</span>
      </button>
      {showAuth &&
        // 导航栏有 backdrop-filter，fixed 定位会被限制在导航条内，弹窗必须挂到 body 下
        createPortal(
          <div className="modal-backdrop" onClick={() => setShowAuth(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <AuthPanel onDone={() => setShowAuth(false)} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
