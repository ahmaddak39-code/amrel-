import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { useStore } from '../lib/store.jsx';

const KEY = 'amrel_intro_seen';
const LETTERS = ['A', 'M', 'R', 'E', 'L'];

/** Заставка: буквы выходят из темноты, сквозь логотип проходит оранжевая линия,
 *  затем экран раскрывается двумя створками. Показывается один раз за сессию. */
export default function Intro() {
  const { setIntroDone } = useStore();
  const [stage, setStage] = useState(() => {
    if (location.pathname.startsWith('/admin')) return 'gone';
    try { if (sessionStorage.getItem(KEY)) return 'gone'; } catch { /* */ }
    return 'play';
  });
  const timers = useRef([]);

  const finish = (fast) => {
    timers.current.forEach(clearTimeout);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* */ }
    setStage('exit');
    setIntroDone(true);
    timers.current = [setTimeout(() => setStage('gone'), fast ? 700 : 1100)];
  };

  useEffect(() => {
    if (stage === 'gone') { setIntroDone(true); return; }
    document.documentElement.classList.add('intro-lock');
    if (prefersReducedMotion()) { timers.current.push(setTimeout(() => finish(true), 900)); }
    else timers.current.push(setTimeout(() => finish(false), 3150));
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') finish(true); };
    window.addEventListener('keydown', onKey);
    return () => { timers.current.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (stage === 'gone') document.documentElement.classList.remove('intro-lock'); }, [stage]);

  if (stage === 'gone') return null;
  return (
    <div className={`intro intro--${stage}`} role="dialog" aria-label="AMREL" aria-live="off">
      <div className="intro__shutter intro__shutter--top" />
      <div className="intro__shutter intro__shutter--bottom" />
      <div className="intro__stage">
        <svg className="intro__mark" viewBox="0 0 100 100" aria-hidden="true">
          <path className="intro__a" d="M50 6 L94 94 H75 L50 42 L25 94 H6 Z" />
          <path className="intro__slash" d="M16 72 L99 41 L94 50 L22 76 Z" />
        </svg>
        <div className="intro__word" aria-label="AMREL">
          {LETTERS.map((l, i) => (
            <span key={l} className="intro__mask"><span className="intro__letter" style={{ '--i': i }}>{l}</span></span>
          ))}
          <span className="intro__gleam" aria-hidden="true" />
        </div>
        <span className="intro__line" aria-hidden="true"><span className="intro__spark" /></span>
        <span className="intro__tag">WITHOUT LIMITS</span>
      </div>
      <button className="intro__skip" onClick={() => finish(true)}>Пропустить</button>
    </div>
  );
}
