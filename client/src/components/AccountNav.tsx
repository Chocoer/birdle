import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, LogOut, UserRound } from 'lucide-react';
import { useStore } from '../store';
import AuthPanel from './AuthPanel';

/** 导航栏最右侧的用户中心：登录/注册、战绩入口、退出登录 */
export default function AccountNav() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);
  const setView = useStore((s) => s.setView);
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const closeMenu = () => setShowMenu(false);
  const goStats = () => {
    closeMenu();
    setView('stats');
  };

  return (
    <div className="account-nav">
      <button className="btn btn-ghost account-nav-btn" onClick={() => setShowMenu((v) => !v)}>
        <UserRound size={16} />
        <span className="nav-btn-text">{user ?? '登录'}</span>
      </button>

      {showMenu && (
        <>
          <div className="account-menu-backdrop" onClick={closeMenu} />
          <div className="account-menu">
            {user && <p className="account-menu-user">{user}</p>}
            <button className="btn btn-ghost account-menu-item" onClick={goStats}>
              <BarChart3 size={14} /> 我的战绩
            </button>
            {user ? (
              <button
                className="btn btn-ghost account-menu-item"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void logout()
                    .then(() => showToast('已退出登录'))
                    .finally(() => {
                      setBusy(false);
                      closeMenu();
                    });
                }}
              >
                <LogOut size={14} /> 退出登录
              </button>
            ) : (
              <button
                className="btn btn-ghost account-menu-item"
                onClick={() => {
                  closeMenu();
                  setShowAuth(true);
                }}
              >
                <UserRound size={14} /> 登录 / 注册
              </button>
            )}
          </div>
        </>
      )}

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
