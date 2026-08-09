import { useStore } from '../store';
import type { Conservation } from '../types';

const OPTIONS: { value: Conservation; name: string; desc: string }[] = [
  { value: 'iucn', name: 'IUCN 红色名录', desc: 'LC / NT / VU / EN / CR 五档濒危等级' },
  { value: 'china', name: '中国国家重点保护', desc: '国家一级 / 二级 / 三有 / 未列入' },
];

export default function Settings() {
  const conservation = useStore((s) => s.conservation);
  const setConservation = useStore((s) => s.setConservation);

  return (
    <div className="settings">
      <h2 className="settings-title">设置</h2>
      <section className="settings-section">
        <h3 className="settings-section-title">保护等级体系</h3>
        <p className="settings-hint">对新开的对局生效</p>
        <div className="settings-options">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={
                conservation === opt.value ? 'settings-option selected' : 'settings-option'
              }
            >
              <input
                type="radio"
                name="conservation"
                value={opt.value}
                checked={conservation === opt.value}
                onChange={() => setConservation(opt.value)}
              />
              <span className="settings-option-name">{opt.name}</span>
              <span className="settings-option-desc">{opt.desc}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
