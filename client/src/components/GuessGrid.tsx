import { useEffect, useState } from 'react';
import type { AttrCell, Conservation, GuessRow } from '../types';
import { CELL_KEYS } from '../types';

const HEADERS = ['鸟名', '目', '科', '属', '体长', '翼展', '居留', '栖息地', '食性', null, '特有'];

interface Props {
  guesses: GuessRow[];
  animatingRow: number;
  conservation: Conservation;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

function arrowOf(cell: AttrCell): string {
  return cell.direction === 'up' ? ' ↑' : cell.direction === 'down' ? ' ↓' : '';
}

function Cell({ cell, animate, delay }: { cell: AttrCell; animate: boolean; delay: number }) {
  const arrow = arrowOf(cell);
  return (
    <td className="grid-cell">
      <div
        className={`cell-inner ${cell.feedback}${animate ? ' flipping' : ''}`}
        style={animate ? { animationDelay: `${delay}ms` } : undefined}
      >
        {cell.value}
        {arrow && <span className="cell-arrow">{arrow}</span>}
      </div>
    </td>
  );
}

/** 手机端：每次猜测一张卡片，属性以胶囊平铺，不需要横向滚动 */
function GuessCard({
  guess,
  isNew,
  conservation,
}: {
  guess: GuessRow;
  isNew: boolean;
  conservation: Conservation;
}) {
  const protection = conservation === 'china' ? '保护' : 'IUCN';
  const labels = ['目', '科', '属', '体长', '翼展', '居留', '栖息地', '食性', protection, '特有'];
  return (
    <div className={`guess-card${isNew ? ' new' : ''}`}>
      <div className="guess-card-head">
        <b>{guess.bird.name}</b>
        <i>{guess.bird.sciName}</i>
      </div>
      <div className="guess-card-cells">
        {CELL_KEYS.map((key, i) => {
          const cell = guess.cells[key];
          return (
            <span key={key} className={`attr-chip ${cell.feedback}`}>
              <em>{labels[i]}</em>
              {cell.value}
              {arrowOf(cell)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function GuessGrid({ guesses, animatingRow, conservation }: Props) {
  const conservationHeader = conservation === 'china' ? '国保' : 'IUCN';
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <div className="guess-cards">
        {guesses.map((guess, rowIndex) => (
          <GuessCard
            key={`${guess.bird.id}-${rowIndex}`}
            guess={guess}
            isNew={rowIndex === animatingRow}
            conservation={conservation}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid-scroll">
        <table className="guess-grid">
          <thead>
            <tr>
              {HEADERS.map((h, i) => (
                <th key={i} className={i === 0 ? 'sticky-col' : undefined}>
                  {h ?? conservationHeader}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guesses.map((guess, rowIndex) => (
              <tr key={`${guess.bird.id}-${rowIndex}`}>
                <td className="grid-cell cell-name sticky-col">
                  <div className="cell-inner name">
                    <span>{guess.bird.name}</span>
                    <span className="cell-sci">{guess.bird.sciName}</span>
                  </div>
                </td>
                {CELL_KEYS.map((key, colIndex) => (
                  <Cell
                    key={key}
                    cell={guess.cells[key]}
                    animate={rowIndex === animatingRow}
                    delay={colIndex * 120}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="scroll-hint">← 左右滑动查看全部属性 →</p>
    </>
  );
}
