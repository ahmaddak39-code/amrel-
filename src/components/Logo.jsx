// Фирменный знак AMREL: «A» без перекладины и оранжевый росчерк сквозь неё.
export function LogoMark({ className = '', title }) {
  return (
    <svg className={`mark ${className}`} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path className="mark__a" d="M50 6 L94 94 H75 L50 42 L25 94 H6 Z" />
      <path className="mark__slash" d="M16 72 L99 41 L94 50 L22 76 Z" />
    </svg>
  );
}

export function Logo({ className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark />
      <span className="logo__word">AMREL</span>
    </span>
  );
}
