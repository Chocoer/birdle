import { useEffect, useRef, useState } from 'react';
import { searchBirds } from '../api';
import type { Difficulty, SearchResult } from '../types';

interface Props {
  disabled: boolean;
  difficulty?: Difficulty;
  onSubmit: (bird: SearchResult) => void;
}

export default function SearchBox({ disabled, difficulty, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    const q = value.trim();
    const seq = ++seqRef.current;
    if (!q) {
      setResults([]);
      setSearched(false);
      setOpen(false);
      setActive(-1);
      return;
    }
    setTimeout(() => {
      if (seq !== seqRef.current) return;
      searchBirds(q, difficulty)
        .then((data) => {
          if (seq !== seqRef.current) return;
          setResults(data.results);
          setSearched(true);
          setOpen(true);
          setActive(data.results.length > 0 ? 0 : -1);
        })
        .catch(() => {
          /* 搜索失败静默忽略，下次输入会重试 */
        });
    }, 200);
  };

  const choose = (bird: SearchResult) => {
    onSubmit(bird);
    setQuery('');
    setResults([]);
    setSearched(false);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (target) choose(target);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-box" ref={boxRef}>
      <input
        className="search-input"
        type="text"
        value={query}
        disabled={disabled}
        placeholder={disabled ? '本局已结束' : '输入鸟名、拼音、首字母或学名…'}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && query.trim() && (
        <ul className="search-dropdown">
          {results.length === 0 && searched ? (
            <li className="search-empty">没有找到这种鸟</li>
          ) : (
            results.map((bird, i) => (
              <li
                key={bird.id}
                className={i === active ? 'search-item active' : 'search-item'}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(bird);
                }}
              >
                <span className="search-item-name">{bird.name}</span>
                <span className="search-item-sci">{bird.sciName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
