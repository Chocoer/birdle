import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useStore } from '../store';
import type { GameState } from '../store';
import type { Feedback } from '../types';
import { DIFFICULTY_LABELS } from '../types';
import BirdCard from './BirdCard';
import GuessGrid from './GuessGrid';
import SearchBox from './SearchBox';

const FEEDBACK_EMOJI: Record<Feedback, string> = {
  green: '🟩',
  yellow: '🟨',
  gray: '⬜',
};

export default function Game() {
  const game = useStore((s) => s.game)!;
  const animatingRow = useStore((s) => s.animatingRow);
  const guessing = useStore((s) => s.guessing);
  const revealing = useStore((s) => s.revealing);
  const submitGuess = useStore((s) => s.submitGuess);
  const revealAnswer = useStore((s) => s.revealAnswer);
  const startGame = useStore((s) => s.startGame);
  const starting = useStore((s) => s.starting);
  const showToast = useStore((s) => s.showToast);
  const [confirmingReveal, setConfirmingReveal] = useState(false);

  const over = game.status !== 'playing';
  const remaining = game.maxGuesses - game.guesses.length;
  const difficultyLabel = DIFFICULTY_LABELS[game.difficulty];

  const share = async () => {
    const text = buildShareText(game, difficultyLabel);
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动复制');
    }
  };

  const confirmReveal = async () => {
    setConfirmingReveal(false);
    await revealAnswer();
  };

  return (
    <div className="game">
      <div className="game-header">
        <h2 className="game-mode">{difficultyLabel}</h2>
        <span className="game-remaining">剩余 {remaining} 次</span>
      </div>

      <SearchBox
        disabled={over || guessing || revealing}
        difficulty={game.difficulty}
        onSubmit={(bird) => void submitGuess(bird.id)}
      />

      {!over && (
        <div className="reveal-row">
          <button
            className="btn btn-ghost reveal-btn"
            disabled={revealing}
            onClick={() => setConfirmingReveal(true)}
          >
            看答案
          </button>
        </div>
      )}

      {game.guesses.length > 0 && (
        <>
          <GuessGrid
            guesses={game.guesses}
            animatingRow={animatingRow}
            conservation={game.conservation}
          />
          <p className="legend">
            <span>
              <i className="swatch green" /> 完全一致
            </span>
            <span>
              <i className="swatch yellow" /> 接近
            </span>
            <span>↑↓ 答案更高或更低</span>
          </p>
        </>
      )}

      {over && (
        <div className="game-result">
          {game.status === 'won' && (
            <p className="result-banner won">
              <Trophy size={18} /> 你用 {game.guesses.length} 次猜中了！
            </p>
          )}
          {game.status === 'lost' && (
            <p className="result-banner lost">
              {game.maxGuesses} 次机会用完，答案是……
            </p>
          )}
          {game.status === 'revealed' && (
            <p className="result-banner lost">你查看了答案，本局记为失败</p>
          )}
          {game.answer && <BirdCard bird={game.answer} />}
          <div className="result-actions">
            <button className="btn btn-primary" onClick={() => void share()}>
              分享战报
            </button>
            <button
              className="btn btn-primary"
              disabled={starting}
              onClick={() => void startGame(game.difficulty)}
            >
              再来一局
            </button>
          </div>
        </div>
      )}

      {confirmingReveal && (
        <div className="modal-backdrop" onClick={() => setConfirmingReveal(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="modal-text">确定要结束本局并查看答案吗？本局将记为失败。</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmingReveal(false)}>
                继续猜
              </button>
              <button className="btn btn-primary" onClick={() => void confirmReveal()}>
                确定看答案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildShareText(game: GameState, difficultyLabel: string): string {
  const count = game.status === 'won' ? String(game.guesses.length) : 'X';
  const lines = game.guesses.map((guess) =>
    (
      ['order', 'family', 'genus', 'length', 'wingspan', 'residence', 'habitats', 'diet', 'conservation', 'endemic'] as const
    )
      .map((key) => FEEDBACK_EMOJI[guess.cells[key].feedback])
      .join(''),
  );
  return [`鹬一把 ${difficultyLabel} ${count}/${game.maxGuesses}`, ...lines].join('\n');
}
