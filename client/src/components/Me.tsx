import Account from './Account';
import Settings from './Settings';
import Stats from './Stats';

/** 「我的」页面：账号 + 个人战绩 + 设置 */
export default function Me() {
  return (
    <div className="me">
      <Account />
      <hr className="me-divider" />
      <Stats />
      <hr className="me-divider" />
      <Settings />
    </div>
  );
}
