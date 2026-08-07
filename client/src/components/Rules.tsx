import { useStore } from '../store';

export default function Rules() {
  const setView = useStore((s) => s.setView);

  return (
    <div className="settings rules">
      <h2 className="settings-title">游戏规则</h2>

      <section className="settings-section">
        <h3 className="settings-section-title">怎么玩</h3>
        <p>
          系统从北京鸟类题库中随机抽取一只鸟作为答案。输入鸟名猜测（支持中文名、全拼、拼音首字母、学名搜索），每次猜测后系统按
          <strong> 10 个属性</strong>逐项给出对比反馈，<strong>8 次机会</strong>内猜中即获胜。
          答不出来可以随时「看答案」——对局立即结束并揭晓，记为失败。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">颜色与箭头</h3>
        <ul className="rules-list">
          <li>🟩 绿色 —— 该属性与答案完全一致</li>
          <li>🟨 黄色 —— 接近：体长/翼展相差 ≤20%；居留/栖息地/食性有交集；保护等级相邻一档</li>
          <li>⬜ 灰色 —— 相差较远</li>
          <li>↑↓ 箭头 —— 体长、翼展、保护等级会提示答案更高（↑）或更低（↓）</li>
        </ul>
        <p className="settings-hint">
          10 个对比属性：目、科、属、体长、翼展、居留类型、栖息地、食性、保护等级、是否中国特有（科和属只有对/错两种状态）
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">单人游戏 · 难度</h3>
        <ul className="rules-list">
          <li>🐣 简单 —— 100 种北京常见鸟，适合所有人</li>
          <li>🐦 普通 —— 200 种（含简单池），适合观鸟入门者</li>
          <li>🦅 困难 —— 全部 435 种（含北京罕见种），北京观鸟爱好者挑战</li>
        </ul>
        <p className="settings-hint">答案和可猜范围都限于所选难度池</p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">居留类型小知识</h3>
        <p>
          题库中的居留类型均按<strong>在北京</strong>的状况标注：
          <strong>留鸟</strong>常年在北京生活；<strong>夏候鸟</strong>春天来北京繁殖、秋天南迁；
          <strong>冬候鸟</strong>秋天来北京越冬、春天北飞；<strong>旅鸟</strong>只在春秋迁徙季路过北京，不停留太久。
          夏候鸟、冬候鸟和旅鸟统称<strong>候鸟</strong>。
        </p>
        <p>
          有些鸟会同时标两种类型，因为不同种群的习性不同——例如<strong>普通鸬鹚</strong>标
          "冬候鸟+旅鸟"：迁徙季大批路过北京（旅鸟），同时也有一部分留下越冬（冬候鸟）；
          <strong>北红尾鸲</strong>标"旅鸟+冬候鸟"：主要是迁徙路过，但市区公园里也有少量稳定越冬的个体。
          所以"旅鸟"和"候鸟"并不矛盾——旅鸟本身就是候鸟的一种，而一只鸟也可以既是旅鸟又是冬候鸟。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">保护等级体系</h3>
        <p>
          「设置」中可切换保护等级列使用的体系：<strong>IUCN 红色名录</strong>（LC/NT/VU/EN/CR
          五档濒危等级）或<strong>中国国家重点保护</strong>（一级/二级/三有/未列入）。
          该设置只影响你自己的判定与显示——联机对战中双方可以各用各的体系。
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">联机对战</h3>
        <ul className="rules-list">
          <li>创建房间获得 5 位房间码，好友输入房间码加入；满 2 人后其他人自动成为观战者</li>
          <li>双方都点「准备」后自动开局，无需等待房主</li>
          <li>每局两人猜<strong>同一只鸟</strong>，各自 8 次机会，谁先猜中谁赢该局；都未猜中则流局</li>
          <li>BO3 三局两胜 / BO5 五局三胜，先拿过半局分者赢整场</li>
          <li>对手的猜测只显示颜色块，看不到鸟名（防窥屏）</li>
          <li>断线 30 秒内重连可恢复；超时判负，对手直接获胜</li>
        </ul>
      </section>

      <button className="btn" onClick={() => setView('home')}>
        返回首页
      </button>
    </div>
  );
}
