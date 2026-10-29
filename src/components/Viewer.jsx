import { useCallback, useEffect, useRef, useState } from 'react';
import { IconZoomIn, IconZoomOut, IconRotate, IconExpand, IconClose } from './Icons.jsx';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Просмотрщик товара.
 *  • 360° — если для цвета загружена серия кадров (8+ фото по кругу): вращение мышью/пальцем по кадрам.
 *  • Перед/спина — если есть два фото: поворот карточки потягиванием, стороны — настоящие фото.
 *  • Дополнительные фото — обычный просмотр с увеличением.
 */
export default function Viewer({ images = [], spin = [], alt = '', variantKey }) {
  const has360 = spin.length >= 8;
  const hasTurn = images.length >= 2;
  const extras = images.slice(2);
  const views = [
    ...(has360 ? [{ id: '360', label: '360°' }] : []),
    ...(hasTurn ? [{ id: 'front', label: 'Перед', img: images[0] }, { id: 'back', label: 'Спина', img: images[1] }]
      : images[0] ? [{ id: 'front', label: 'Фото', img: images[0] }] : []),
    ...extras.map((img, i) => ({ id: `x${i}`, label: `Фото ${i + 3}`, img })),
  ];
  const [view, setView] = useState(views[0]?.id || 'front');
  const [angle, setAngle] = useState(0); // градусы для поворота перед/спина
  const [frame, setFrame] = useState(0); // кадр 360
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [full, setFull] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const stage = useRef(null);
  const st = useRef({});

  // при смене цвета — исходный ракурс
  useEffect(() => { setView(views[0]?.id || 'front'); setAngle(0); setZoom(1); setPan({ x: 0, y: 0 }); setFrame(0); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey]);
  // предзагрузка кадров 360
  useEffect(() => {
    if (!has360) return;
    let n = 0;
    spin.forEach((src) => { const im = new Image(); im.onload = () => setLoaded(++n); im.src = src; });
  }, [spin, has360]);
  useEffect(() => { document.documentElement.classList.toggle('viewer-lock', full); }, [full]);
  useEffect(() => {
    if (!full) return;
    const on = (e) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [full]);

  const turnMode = hasTurn && (view === 'front' || view === 'back');
  const current = views.find((v) => v.id === view);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setAngle(view === 'back' ? 180 : 0); setFrame(0); };
  const goView = (id) => {
    setZoom(1); setPan({ x: 0, y: 0 });
    if (hasTurn && (id === 'front' || id === 'back')) {
      // поворачиваем в ближайшую сторону
      const target = id === 'back' ? 180 : 0;
      setAngle((a) => { const base = Math.round(a / 360) * 360; return base + target; });
    }
    setView(id);
  };
  const zoomBy = (d) => setZoom((z) => { const nz = clamp(+(z + d).toFixed(2), 1, 3); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });

  // --- жесты: перетаскивание, щипок, двойной тап ---
  const pointers = useRef(new Map());
  const onDown = (e) => {
    stage.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = st.current;
    cancelAnimationFrame(s.raf);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
      return;
    }
    s.start = { x: e.clientX, y: e.clientY, angle, frame, pan, t: performance.now() };
    s.last = { x: e.clientX, t: performance.now() }; s.vel = 0; s.moved = false;
    setDragging(true);
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = st.current;
    if (s.pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoom(clamp(s.pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / s.pinch.d), 1, 3));
      return;
    }
    if (!s.start) return;
    const dx = e.clientX - s.start.x; const dy = e.clientY - s.start.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) s.moved = true;
    const now = performance.now();
    s.vel = (e.clientX - s.last.x) / Math.max(1, now - s.last.t); s.last = { x: e.clientX, t: now };
    if (zoom > 1) {
      const w = stage.current.clientWidth; const h = stage.current.clientHeight;
      const mx = (w * (zoom - 1)) / 2; const my = (h * (zoom - 1)) / 2;
      setPan({ x: clamp(s.start.pan.x + dx, -mx, mx), y: clamp(s.start.pan.y + dy, -my, my) });
    } else if (view === '360') {
      const w = stage.current.clientWidth;
      const step = w / spin.length / 1.2;
      setFrame(((s.start.frame - Math.round(dx / step)) % spin.length + spin.length) % spin.length);
    } else if (turnMode) {
      setAngle(s.start.angle + dx * (180 / stage.current.clientWidth) * 1.4);
    }
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    const s = st.current;
    if (pointers.current.size < 2) s.pinch = null;
    if (!s.start) return;
    setDragging(false);
    const tap = !s.moved && performance.now() - s.start.t < 250;
    s.start = null;
    if (tap) {
      const now = performance.now();
      if (now - (s.lastTap || 0) < 320) { setZoom((z) => (z > 1 ? 1 : 2)); setPan({ x: 0, y: 0 }); s.lastTap = 0; }
      else s.lastTap = now;
      return;
    }
    if (zoom > 1) return;
    if (view === '360') {
      // инерция
      let v = s.vel * 16; let acc = 0;
      const w = stage.current.clientWidth; const step = w / spin.length / 1.2;
      const tick = () => {
        v *= 0.92; acc += v;
        if (Math.abs(acc) >= step) { const k = Math.trunc(acc / step); acc -= k * step; setFrame((f) => ((f - k) % spin.length + spin.length) % spin.length); }
        if (Math.abs(v) > 0.4) s.raf = requestAnimationFrame(tick);
      };
      tick();
    } else if (turnMode) {
      // докручиваем до ближайшей стороны с учётом скорости
      const snapped = Math.round((angle + clamp(s.vel * 60, -80, 80)) / 180) * 180;
      setAngle(snapped);
      setView(((snapped % 360) + 360) % 360 === 180 ? 'back' : 'front');
    }
  };
  const onWheel = useCallback((e) => {
    if (!e.ctrlKey && zoom === 1) return; // обычная прокрутка страницы не блокируется
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
  }, [zoom]);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const norm = ((angle % 360) + 360) % 360;
  const sheen = Math.abs(Math.sin((angle * Math.PI) / 180));
  const transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
  const hint = view === '360' ? 'Потяните — вращение 360°' : turnMode ? 'Потяните — повернуть' : 'Двойной тап — увеличить';

  return (
    <div className={`viewer ${full ? 'is-full' : ''}`}>
      {full && <div className="viewer__veil" onClick={() => setFull(false)} />}
      <div className="viewer__box">
        <div ref={stage} className={`viewer__stage ${dragging ? 'is-dragging' : ''} ${zoom > 1 ? 'is-zoomed' : ''}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          role="img" aria-label={`${alt}: ${current?.label || ''}`}>
          <div className="viewer__zoom" style={{ transform }}>
            {view === '360' ? (
              <div className="viewer__spin">
                {spin.map((src, i) => <img key={src} src={src} alt="" draggable="false" style={{ opacity: i === frame ? 1 : 0 }} />)}
                {loaded < spin.length && <span className="viewer__loading">Загрузка кадров {loaded}/{spin.length}</span>}
              </div>
            ) : turnMode ? (
              <div className="viewer__card" style={{ transform: `rotateY(${angle}deg)`, transition: dragging ? 'none' : undefined }}>
                <img className="viewer__face" src={images[0]} alt={`${alt} — перед`} draggable="false" />
                <img className="viewer__face viewer__face--back" src={images[1]} alt={`${alt} — спина`} draggable="false" />
                <span className="viewer__sheen" style={{ opacity: sheen * 0.55 }} />
              </div>
            ) : current?.img ? (
              <img key={current.img} className="viewer__single" src={current.img} alt={alt} draggable="false" />
            ) : <div className="viewer__empty">Фото скоро появится</div>}
          </div>
          <span className="viewer__floor" />
        </div>

        <div className="viewer__hud">
          <span className="viewer__hint">{hint}</span>
          <div className="viewer__tools">
            <button className="icon-btn" onClick={() => zoomBy(-0.5)} disabled={zoom <= 1} aria-label="Отдалить"><IconZoomOut /></button>
            <button className="icon-btn" onClick={() => zoomBy(0.5)} disabled={zoom >= 3} aria-label="Приблизить"><IconZoomIn /></button>
            <button className="icon-btn" onClick={reset} aria-label="Исходный ракурс"><IconRotate /></button>
            <button className="icon-btn" onClick={() => setFull((f) => !f)} aria-label={full ? 'Закрыть полноэкранный режим' : 'Во весь экран'}>{full ? <IconClose /> : <IconExpand />}</button>
          </div>
        </div>
        {turnMode && (
          <div className="viewer__dial" aria-hidden="true">
            <span style={{ transform: `rotate(${norm}deg)` }} />
          </div>
        )}
      </div>

      {views.length > 1 && (
        <div className="viewer__thumbs" role="tablist" aria-label="Ракурсы">
          {views.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} className={`vthumb ${view === v.id ? 'is-active' : ''}`} onClick={() => goView(v.id)}>
              {v.id === '360' ? <span className="vthumb__360">360°</span> : <img src={v.img} alt="" loading="lazy" />}
              <span className="vthumb__label">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
