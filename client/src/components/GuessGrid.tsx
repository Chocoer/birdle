import type { AttrCell, Conservation, GuessRow } from '../types';
import { CELL_KEYS } from '../types';

const HEADERS = ['鸟名', '目', '科', '属', '体长', '翼展', '居留', '栖息地', '食性', null, '特有'];

interface Props {
  guesses: GuessRow[];
  animatingRow: number;
  conservation: Conservation;
}

function Cell({ cell, animate, delay }: { cell: AttrCell; animate: boolean; delay: number }) {
  const arrow = cell.direction === 'up' ? ' ↑' : cell.direction === 'down' ? ' ↓' : '';
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

export default function GuessGrid({ guesses, animatingRow, conservation }: Props) {
  const conservationHeader = conservation === 'china' ? '国保' : 'IUCN';
  return (
    <div className="grid-scroll">
      <table className="guess-grid">
        <thead>
          <tr>
            {HEADERS.map((h, i) => (
              <th key={i}>{h ?? conservationHeader}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guesses.map((guess, rowIndex) => (
            <tr key={`${guess.bird.id}-${rowIndex}`}>
              <td className="grid-cell cell-name">
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
  );
}
