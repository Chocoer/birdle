import { Bird, Crown, Egg, Globe, Swords, Timer, Trophy } from 'lucide-react';
import { useStore } from '../store';

export default function Rules() {
  const setView = useStore((s) => s.setView);

  return (
    <div className="settings rules">
      <h2 className="settings-title">游戏规则</h2>

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">怎么玩</h3>
        <p>
          系统从北京鸟类题库中随机抽取一只鸟作为答案。输入鸟名猜测（支持中文名、全拼、拼音首字母、学名搜索），每次猜测后系统按
          <strong> 10 个属性</strong>逐项给出对比反馈，<strong>8 次机会</strong>内猜中即获胜。
          答不出来可以随时「看答案」——对局立即结束并揭晓，记为失败。
        </p>
        <p className="settings-hint">
          10 个对比属性：目、科、属、体长、翼展、居留类型、栖息地、食性、保护等级、是否中国特有（科和属只有对/错两种状态）
        </p>
      </section>

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">颜色与箭头</h3>
        <ul className="rules-list rules-chips">
          <li>
            <span className="rules-chip chip-green">
              <i className="swatch green" /> 绿色
            </span>
            该属性与答案完全一致
          </li>
          <li>
            <span className="rules-chip chip-yellow">
              <i className="swatch yellow" /> 黄色
            </span>
            接近：体长/翼展相差 ≤20%；居留/栖息地/食性有交集；保护等级相邻一档
          </li>
          <li>
            <span className="rules-chip chip-gray">
              <i className="swatch gray" /> 灰色
            </span>
            相差较远
          </li>
          <li>
            <span className="rules-chip chip-arrow">↑ ↓</span>
            体长、翼展、保护等级会提示答案更高（↑）或更低（↓）
          </li>
        </ul>
      </section>

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">单人游戏 · 难度</h3>
        <ul className="rules-list rules-chips">
          <li>
            <span className="rules-chip chip-diff">
              <Egg size={14} /> 简单
            </span>
            100 种城区公园基础常见鸟
          </li>
          <li>
            <span className="rules-chip chip-diff">
              <Bird size={14} /> 普通
            </span>
            加入季节性候鸟与郊区鸟种，共 200 种
          </li>
          <li>
            <span className="rules-chip chip-diff">
              <Crown size={14} /> 困难
            </span>
            含罕见种与迷鸟的完整名录，共 435 种
          </li>
        </ul>
        <p className="settings-hint">答案和可猜范围都限于所选难度池</p>
      </section>

      <section className="settings-section rules-card">
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

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">保护等级体系</h3>
        <div className="rules-two-col">
          <div className="rules-mini-card">
            <p className="rules-mini-title">
              <Globe size={15} /> IUCN 红色名录
            </p>
            <p className="rules-mini-desc">LC / NT / VU / EN / CR 五档濒危等级，国际通用</p>
          </div>
          <div className="rules-mini-card">
            <p className="rules-mini-title">
              <Trophy size={15} /> 中国国家重点保护
            </p>
            <p className="rules-mini-desc">国家一级 / 二级 / 三有 / 未列入，国内名录</p>
          </div>
        </div>
        <p className="settings-hint">
          在「设置」页面中切换，只影响你自己的判定与显示——联机对战中双方可以各用各的体系
        </p>
      </section>

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">
          <Swords size={16} /> 联机对战
        </h3>
        <ul className="rules-list">
          <li>创建房间获得 5 位房间码，好友输入房间码加入；满 2 人后其他人自动成为观战者</li>
          <li>也可以用「快速匹配」：同难度同赛制优先配对，等待 30 秒后放宽条件</li>
          <li>双方都点「准备」后自动开局，无需等待房主</li>
          <li>
            每局两人猜<strong>同一只鸟</strong>，各自 8 次机会，谁先猜中谁赢该局；都未猜中则流局
          </li>
          <li>
            <Timer size={13} /> 每局限时 2 分钟，时间到无人猜中则公布答案、本局流局，双方准备后进入下一局
          </li>
          <li>BO3 三局两胜 / BO5 五局三胜，先拿过半局分者赢整场</li>
          <li>对手的猜测只显示颜色块，看不到鸟名（防窥屏）</li>
          <li>断线 30 秒内重连可恢复；超时判负，对手直接获胜</li>
        </ul>
      </section>

      <section className="settings-section rules-card">
        <h3 className="settings-section-title">数据与反馈</h3>
        <p>
          题库收录 435 种北京有野生记录的鸟类，分类、居留、保护等级按《中国鸟类分类与分布名录》、
          IUCN 红色名录和国家重点保护名录整理，体长翼展为典型值。数据持续校订中——
          如果你发现某只鸟的信息有误，欢迎在
          <a href="https://github.com/Suyuanzhe/birdle/issues" target="_blank" rel="noreferrer"> GitHub Issues </a>
          反馈，我们会尽快修正。
        </p>
      </section>

      <button className="btn" onClick={() => setView('home')}>
        返回首页
      </button>
    </div>
  );
}
