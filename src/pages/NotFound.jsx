import { Link } from '../lib/router.jsx';
import { SplitText, Reveal } from '../lib/motion.jsx';
import { IconArrow } from '../components/Icons.jsx';

export default function NotFound({ text = 'Страница не найдена или была перемещена.' }) {
  return (
    <main className="page page--404">
      <SplitText as="h1" text="404" by="chars" stagger={90} className="nf__code" />
      <Reveal as="p" variant="up" delay={300} className="nf__text">{text}</Reveal>
      <Reveal variant="up" delay={450}>
        <Link to="/catalog" className="btn btn--light"><span>В каталог</span><IconArrow width={18} /></Link>
      </Reveal>
    </main>
  );
}
