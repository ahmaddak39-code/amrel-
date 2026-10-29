import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { useStore } from '../lib/store.jsx';
import { Reveal, SplitText, useInView, useParallax, useScrollProgress } from '../lib/motion.jsx';
import ProductCard from '../components/ProductCard.jsx';
import QuickView from '../components/QuickView.jsx';
import { IconArrow, IconArrowUpRight } from '../components/Icons.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { waLink, telLink, igLink } from '../lib/format.js';

function HeroPanel({ src, i, main }) {
  const ref = useRef(null);
  useParallax(ref, [0.05, 0.1, 0.035][i] ?? 0.06, { scale: 1.08 });
  return (
    <div className={`hero__panel ${main ? 'is-main' : ''}`} style={{ '--i': i }}>
      <div className="hero__img" ref={ref}>
        <img src={src} alt={main ? 'Футболка AMREL — принт на спине' : ''} aria-hidden={main ? undefined : true} fetchpriority={main ? 'high' : undefined} />
      </div>
    </div>
  );
}

function Hero() {
  const { settings, introDone, catalog } = useStore();
  const h = settings.hero;
  const panels = [h.imageSecondary, h.image, h.imageThird].filter(Boolean);
  const lines = h.title.split(' ').reduce((acc, w) => {
    // делим заголовок на 2–3 строки по словам
    const last = acc[acc.length - 1];
    if (last && (last + ' ' + w).length <= 9) acc[acc.length - 1] = `${last} ${w}`; else acc.push(w);
    return acc;
  }, []);
  const go = introDone;
  const count = catalog?.products.length || 0;
  return (
    <section className={`hero ${go ? 'is-go' : ''}`} id="home">
      <div className={`hero__media hero__media--${panels.length}`}>
        {panels.map((src, i) => <HeroPanel key={src + i} src={src} i={i} main={src === h.image} />)}
        <span className="hero__coords">42.8760° N / 47.6265° E</span>
      </div>
      <div className="hero__content">
        <Reveal variant="fade" when={go} delay={200} className="hero__eyebrow">
          <span className="hero__eyebrow-line" />{h.eyebrow}
        </Reveal>
        <h1 className="hero__title" aria-label={h.title}>
          {lines.map((l, i) => (
            <span key={i} className="hero__line" aria-hidden="true"><span style={{ '--i': i }}>{l}</span></span>
          ))}
        </h1>
        <span className="hero__rule" aria-hidden="true" />
        <Reveal as="p" variant="up" when={go} delay={1000} className="hero__subtitle">{h.subtitle}</Reveal>
        <div className="hero__ctas">
          <Reveal variant="left" when={go} delay={1150}>
            <Link to="/catalog" className="btn btn--light"><span>Смотреть коллекцию</span><IconArrow width={18} /></Link>
          </Reveal>
          <Reveal variant="left" when={go} delay={1260}>
            <Link to="/#about" className="btn btn--ghost"><span>О бренде AMREL</span></Link>
          </Reveal>
        </div>
        <Reveal variant="fade" when={go} delay={1500} className="hero__meta">
          <span>{String(count).padStart(2, '0')} моделей</span><span>Oversize fit</span><span>Fearless / Limitless</span>
        </Reveal>
      </div>
      <Reveal variant="fade" when={go} delay={1700} className="hero__scroll" aria-hidden="true">
        <span>Scroll</span><i />
      </Reveal>
    </section>
  );
}

function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <Reveal variant="fade" className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {[0, 1].map((k) => (
          <div key={k} className="marquee__row">
            {row.map((t, i) => <span key={i} className="marquee__item">{t}<LogoMark className="marquee__mark" /></span>)}
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function SectionHead({ index, label, title, children }) {
  return (
    <div className="shead">
      <Reveal variant="line" className="shead__meta"><span className="shead__idx">{index}</span><span className="shead__label">{label}</span></Reveal>
      <SplitText as="h2" text={title} className="shead__title" by="words" stagger={70} />
      {children}
    </div>
  );
}

function Featured({ onQuick }) {
  const { catalog } = useStore();
  const list = useMemo(() => {
    const f = catalog.products.filter((p) => p.featured);
    return (f.length ? f : catalog.products).slice(0, 6);
  }, [catalog]);
  const grid = useRef(null);
  const on = useInView(grid, { threshold: 0.08 });
  if (!list.length) return null;
  return (
    <section className="section featured">
      <SectionHead index="01" label="Избранная коллекция" title="Избранное AMREL">
        <Reveal variant="fade" delay={300}><Link to="/catalog" className="arrow-link">Весь каталог <IconArrow width={16} /></Link></Reveal>
      </SectionHead>
      <div ref={grid} className={`grid stagger ${on ? 'is-in' : ''}`}>
        {list.map((p, i) => <ProductCard key={p.id} product={p} index={i} onQuick={onQuick} />)}
      </div>
    </section>
  );
}

function Slogan({ text }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref, { start: 0.95, end: 0.35 });
  const words = text.split(' ');
  let n = 0;
  return (
    <section ref={ref} className="slogan" aria-label={text}>
      <div className="slogan__inner" aria-hidden="true">
        {words.map((w, wi) => (
          <span key={wi} className="slogan__word">
            {[...w].map((ch, ci) => {
              const i = n++;
              const local = Math.min(1, Math.max(0, p * 1.6 - i * 0.045));
              return <span key={ci} className="slogan__ch" style={{ '--p': local }}>{ch}</span>;
            })}
          </span>
        ))}
      </div>
      <span className="slogan__line" style={{ transform: `scaleX(${Math.min(1, p * 1.15)})` }} />
      <span className="slogan__caption" style={{ opacity: Math.max(0, p * 2 - 1) }}>Your style. Your rules.</span>
    </section>
  );
}

function Lookbook({ items }) {
  const track = useRef(null);
  if (!items?.length) return null;
  return (
    <section className="section lookbook">
      <SectionHead index="02" label="Лукбук" title="Коллекция в деталях">
        <Reveal variant="fade" delay={300} className="lookbook__hint">Листайте →</Reveal>
      </SectionHead>
      <div className="lookbook__track" ref={track}>
        {items.map((it, i) => <LookItem key={i} item={it} i={i} />)}
      </div>
    </section>
  );
}
function LookItem({ item, i }) {
  const img = useRef(null);
  useParallax(img, 0.05, { scale: 1.12 });
  const body = (
    <>
      <span className="look__img"><img ref={img} src={item.image} alt={item.caption} loading="lazy" /></span>
      <span className="look__cap"><span className="look__num">{String(i + 1).padStart(2, '0')}</span>{item.caption}<IconArrowUpRight width={16} /></span>
    </>
  );
  return (
    <Reveal variant="clip-x" delay={i * 120} className="look" threshold={0.2}>
      {item.link ? <Link to={item.link} className="look__link">{body}</Link> : <div className="look__link">{body}</div>}
    </Reveal>
  );
}

function About({ about }) {
  const img = useRef(null);
  useParallax(img, 0.07, { scale: 1.1 });
  const paragraphs = about.text.split(/\n+/).filter(Boolean);
  return (
    <section className="section about" id="about">
      <div className="about__grid">
        <div className="about__media">
          <Reveal variant="clip-y" className="about__frame">
            {about.image && <img ref={img} src={about.image} alt="Коллекция AMREL" loading="lazy" />}
          </Reveal>
          <Reveal variant="fade" delay={500} className="about__stamp"><LogoMark /><span>AMREL — Without limits</span></Reveal>
        </div>
        <div className="about__text">
          <Reveal variant="line" className="shead__meta"><span className="shead__idx">03</span><span className="shead__label">О бренде</span></Reveal>
          <SplitText as="h2" text={about.title} className="about__title" by="chars" stagger={28} />
          {about.lead && <Reveal as="p" variant="mask" delay={200} className="about__lead">{about.lead}</Reveal>}
          {paragraphs.map((t, i) => <Reveal as="p" key={i} variant="up" delay={300 + i * 120} className="about__p">{t}</Reveal>)}
          {about.pillars?.length > 0 && (
            <div className="pillars">
              {about.pillars.map((p, i) => (
                <Reveal key={i} variant="up" delay={200 + i * 140} className="pillar">
                  <span className="pillar__n">0{i + 1}</span>
                  <span className="pillar__rule" />
                  <h3 className="pillar__t">{p.title}</h3>
                  <p className="pillar__d">{p.text}</p>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Quote({ text }) {
  const ref = useRef(null);
  const p = useScrollProgress(ref, { start: 0.9, end: 0.3 });
  const words = text.split(' ');
  return (
    <section ref={ref} className="quote" aria-label={text}>
      <LogoMark className="quote__mark" />
      <p className="quote__text" aria-hidden="true">
        {words.map((w, i) => {
          const t = Math.min(1, Math.max(0, p * (words.length + 2) - i));
          const accent = i >= words.length - 2;
          return <Fragment key={i}><span className={`quote__w ${accent ? 'is-accent' : ''}`} style={{ '--t': t }}>{w}</span>{' '}</Fragment>;
        })}
      </p>
    </section>
  );
}

function Contacts({ c }) {
  const rows = [
    c.address && { k: 'Адрес', v: c.address },
    c.phone && { k: 'Телефон', v: c.phone, href: telLink(c.phone) },
    c.whatsapp && { k: 'WhatsApp', v: 'Написать в WhatsApp', href: waLink(c.whatsapp, c.whatsappText), ext: true },
    c.instagram && { k: 'Instagram', v: `Instagram: @${c.instagram}`, href: igLink(c.instagram), ext: true, noIcon: true },
    c.hours && { k: 'Часы работы', v: c.hours },
  ].filter(Boolean);
  return (
    <section className="section contacts" id="contacts">
      <SectionHead index="04" label="Контакты" title="Приходите или напишите" />
      <div className="contacts__list">
        {rows.map((r, i) => (
          <Reveal key={r.k} variant="row" delay={i * 110} className="crow">
            <span className="crow__k">{r.k}</span>
            {r.href ? (
              <a className="crow__v" href={r.href} {...(r.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span>{r.v}</span>{!r.noIcon && <IconArrowUpRight className="crow__icon" width={22} height={22} />}
              </a>
            ) : <span className="crow__v"><span>{r.v}</span></span>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { settings, catalog } = useStore();
  const [quick, setQuick] = useState(null);
  if (!settings || !catalog) return <div className="page-loading" />;
  return (
    <main className="page page--home">
      <Hero />
      <Marquee items={settings.marquee || []} />
      <Featured onQuick={(product, variantId) => setQuick({ product, variantId })} />
      <Slogan text={settings.slogan} />
      <Lookbook items={settings.lookbook} />
      <About about={settings.about} />
      <Quote text={settings.quote} />
      <Contacts c={settings.contacts} />
      <QuickView state={quick} onClose={() => setQuick(null)} />
    </main>
  );
}
