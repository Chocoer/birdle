import Settings from './Settings';
import Stats from './Stats';

/** 「我的」页面：个人战绩 + 设置 */
export default function Me() {
  return (
    <div className="me">
      <Stats />
      <hr className="me-divider" />
      <Settings />
    </div>
  );
}
