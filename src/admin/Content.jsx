import { useEffect, useRef, useState } from 'react';
import { api, uploadImage } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { PageHead, SingleImage } from './ui.jsx';
import { IconPlus, IconTrash } from '../components/Icons.jsx';

const F = ({ label, children, wide = true, hint }) => (
  <label className={`field ${wide ? 'field--wide' : ''}`}><span className="field__label">{label}</span>{children}{hint && <small className="adm-hint">{hint}</small>}</label>
);

function ShareCover({ share, onChange, guard }) {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try { onChange({ ...share, image: await uploadImage(file, { cover: [1200, 630] }) }); toast.success('Обложка загружена — нажмите «Сохранить»'); }
    catch (e) { if (!guard(e)) toast.error(e.message); }
    finally { setBusy(false); }
  };
  const img = share.image || '/img/share.jpg';
  return (
    <div className="share">
      <div className="share__chat">
        <div className="share__bubble">
          <div className="share__img"><img src={img} alt="Обложка ссылки" />{busy && <span className="share__busy">Загрузка…</span>}</div>
          <div className="share__meta">
            <b>{share.title || 'AMREL — стиль без границ'}</b>
            <span>{share.description || 'AMREL — streetwear-бренд. Оверсайз-футболки с авторскими принтами.'}</span>
            <small>amrel.vercel.app</small>
          </div>
          <div className="share__link">https://amrel.vercel.app</div>
        </div>
        <p className="adm-hint">Так ссылка на сайт будет выглядеть в WhatsApp, Telegram и других мессенджерах</p>
      </div>
      <div className="share__actions">
        <button type="button" className="btn btn--light btn--sm" disabled={busy} onClick={() => input.current.click()}><span>{busy ? 'Загрузка…' : 'Выбрать фото обложки'}</span></button>
        {share.image && share.image !== '/img/share.jpg' && (
          <button type="button" className="link-btn" onClick={() => onChange({ ...share, image: '' })}>Вернуть обложку AMREL</button>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export default function Content({ guard, onChanged }) {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState('');
  useEffect(() => { api('/api/admin/settings').then(setS).catch((e) => { if (!guard(e)) toast.error(e.message); }); }, [guard, toast]);
  if (!s) return <div className="adm-loading">Загрузка…</div>;

  const upd = (key, val) => setS((x) => ({ ...x, [key]: val }));
  const sub = (key, k, v) => setS((x) => ({ ...x, [key]: { ...x[key], [k]: v } }));
  const save = async (keys, label) => {
    setSaving(label);
    try {
      const body = Object.fromEntries(keys.map((k) => [k, s[k]]));
      setS(await api('/api/admin/settings', { method: 'PUT', body }));
      toast.success(`«${label}» сохранено`); onChanged();
    } catch (e) { if (!guard(e)) toast.error(e.message); }
    finally { setSaving(''); }
  };
  const SaveBtn = ({ keys, label }) => (
    <button type="button" className="btn btn--accent btn--sm" disabled={!!saving} onClick={() => save(keys, label)}><span>{saving === label ? 'Сохраняем…' : 'Сохранить'}</span></button>
  );
  const sc = s.sizeChart;

  return (
    <div className="adm-page">
      <PageHead title="Тексты и блоки" sub="Всё, что видят покупатели на главной странице и в контактах" />

      <section className="adm-card">
        <div className="adm-card__head"><h3>Обложка ссылки</h3><SaveBtn keys={['share']} label="Обложка ссылки" /></div>
        <p className="muted">Картинка и подпись, которые появляются, когда вы отправляете ссылку на сайт. Лучше горизонтальное фото — оно обрежется до формата превью.</p>
        <ShareCover share={s.share} onChange={(v) => upd('share', v)} guard={guard} />
        <div className="fields">
          <F label="Заголовок превью" wide={false} hint="Пусто — «AMREL — стиль без границ»"><input value={s.share.title} onChange={(e) => sub('share', 'title', e.target.value)} maxLength={90} /></F>
          <F label="Описание превью" wide={false} hint="Короткая фраза под заголовком"><input value={s.share.description} onChange={(e) => sub('share', 'description', e.target.value)} maxLength={200} /></F>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Главный баннер</h3><SaveBtn keys={['hero']} label="Главный баннер" /></div>
        <F label="Надпись над заголовком"><input value={s.hero.eyebrow} onChange={(e) => sub('hero', 'eyebrow', e.target.value)} maxLength={80} /></F>
        <F label="Заголовок"><input value={s.hero.title} onChange={(e) => sub('hero', 'title', e.target.value)} maxLength={80} /></F>
        <F label="Подзаголовок"><input value={s.hero.subtitle} onChange={(e) => sub('hero', 'subtitle', e.target.value)} maxLength={200} /></F>
        <div className="fields">
          <F label="Левое фото" wide={false}><SingleImage value={s.hero.imageSecondary} onChange={(v) => sub('hero', 'imageSecondary', v)} guard={guard} /></F>
          <F label="Центральное (главное) фото" wide={false}><SingleImage value={s.hero.image} onChange={(v) => sub('hero', 'image', v)} guard={guard} /></F>
          <F label="Правое фото" wide={false}><SingleImage value={s.hero.imageThird} onChange={(v) => sub('hero', 'imageThird', v)} guard={guard} /></F>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Слоган, цитата, бегущая строка</h3><SaveBtn keys={['slogan', 'quote', 'marquee']} label="Слоган и цитата" /></div>
        <F label="Слоган (крупная надпись)"><input value={s.slogan} onChange={(e) => upd('slogan', e.target.value)} maxLength={60} /></F>
        <F label="Цитата бренда"><input value={s.quote} onChange={(e) => upd('quote', e.target.value)} maxLength={120} /></F>
        <F label="Бегущая строка" hint="Каждая фраза с новой строки"><textarea rows={4} value={s.marquee.join('\n')} onChange={(e) => upd('marquee', e.target.value.split('\n'))} /></F>
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>О бренде</h3><SaveBtn keys={['about']} label="О бренде" /></div>
        <F label="Заголовок"><input value={s.about.title} onChange={(e) => sub('about', 'title', e.target.value)} maxLength={80} /></F>
        <F label="Короткая фраза"><input value={s.about.lead} onChange={(e) => sub('about', 'lead', e.target.value)} maxLength={160} /></F>
        <F label="Текст" hint="Пустая строка — новый абзац"><textarea rows={7} value={s.about.text} onChange={(e) => sub('about', 'text', e.target.value)} maxLength={3000} /></F>
        <F label="Фото"><SingleImage value={s.about.image} onChange={(v) => sub('about', 'image', v)} guard={guard} /></F>
        <h4 className="adm-sub">Три принципа</h4>
        {s.about.pillars.map((p, i) => (
          <div key={i} className="fields">
            <F label={`Принцип ${i + 1}`} wide={false}><input value={p.title} maxLength={40} onChange={(e) => sub('about', 'pillars', s.about.pillars.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} /></F>
            <F label="Пояснение" wide={false}><input value={p.text} maxLength={200} onChange={(e) => sub('about', 'pillars', s.about.pillars.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} /></F>
          </div>
        ))}
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Лукбук</h3><SaveBtn keys={['lookbook']} label="Лукбук" /></div>
        {s.lookbook.map((l, i) => (
          <div key={i} className="lookrow">
            <SingleImage value={l.image} onChange={(v) => upd('lookbook', s.lookbook.map((x, k) => (k === i ? { ...x, image: v } : x)))} guard={guard} />
            <div className="lookrow__fields">
              <F label="Подпись"><input value={l.caption} maxLength={60} onChange={(e) => upd('lookbook', s.lookbook.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))} /></F>
              <F label="Ссылка" hint="Например /product/tokyo-drive или /catalog"><input value={l.link} maxLength={200} onChange={(e) => upd('lookbook', s.lookbook.map((x, k) => (k === i ? { ...x, link: e.target.value } : x)))} /></F>
            </div>
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => upd('lookbook', s.lookbook.filter((_, k) => k !== i))} aria-label="Удалить"><IconTrash width={16} /></button>
          </div>
        ))}
        {s.lookbook.length < 10 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => upd('lookbook', [...s.lookbook, { image: s.hero.image, caption: '', link: '/catalog' }])}><IconPlus width={14} /><span>Добавить фото</span></button>}
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Контакты</h3><SaveBtn keys={['contacts']} label="Контакты" /></div>
        <div className="fields">
          <F label="Адрес" wide={false}><input value={s.contacts.address} onChange={(e) => sub('contacts', 'address', e.target.value)} /></F>
          <F label="Телефон" wide={false}><input value={s.contacts.phone} onChange={(e) => sub('contacts', 'phone', e.target.value)} /></F>
          <F label="WhatsApp (цифры, с кодом страны)" wide={false}><input value={s.contacts.whatsapp} onChange={(e) => sub('contacts', 'whatsapp', e.target.value)} inputMode="numeric" /></F>
          <F label="Instagram (имя аккаунта)" wide={false}><input value={s.contacts.instagram} onChange={(e) => sub('contacts', 'instagram', e.target.value)} /></F>
        </div>
        <F label="Готовое сообщение для WhatsApp"><input value={s.contacts.whatsappText} onChange={(e) => sub('contacts', 'whatsappText', e.target.value)} maxLength={300} /></F>
        <F label="Часы работы (необязательно)"><input value={s.contacts.hours} onChange={(e) => sub('contacts', 'hours', e.target.value)} maxLength={120} /></F>
        <div className="adm-card__head"><h3>Доставка и оплата</h3><SaveBtn keys={['delivery']} label="Доставка" /></div>
        <F label="Текст на странице товара"><textarea rows={3} value={s.delivery} onChange={(e) => upd('delivery', e.target.value)} maxLength={1500} /></F>
      </section>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Таблица размеров</h3><SaveBtn keys={['sizeChart']} label="Таблица размеров" /></div>
        <p className="adm-hint">Пока строк нет, ссылка «Таблица размеров» на сайте не показывается.</p>
        <div className="table-wrap">
          <table className="sctable sctable--edit">
            <thead><tr>{sc.columns.map((c, i) => (
              <th key={i}><input value={c} onChange={(e) => upd('sizeChart', { ...sc, columns: sc.columns.map((x, k) => (k === i ? e.target.value : x)) })} /></th>
            ))}<th /></tr></thead>
            <tbody>{sc.rows.map((r, ri) => (
              <tr key={ri}>{sc.columns.map((_, ci) => (
                <td key={ci}><input value={r[ci] || ''} onChange={(e) => upd('sizeChart', { ...sc, rows: sc.rows.map((row, k) => (k === ri ? sc.columns.map((__, j) => (j === ci ? e.target.value : row[j] || '')) : row)) })} /></td>
              ))}<td><button type="button" className="icon-btn" onClick={() => upd('sizeChart', { ...sc, rows: sc.rows.filter((_, k) => k !== ri) })} aria-label="Удалить строку"><IconTrash width={14} /></button></td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="adm-actions adm-actions--left">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => upd('sizeChart', { ...sc, rows: [...sc.rows, sc.columns.map(() => '')] })}><IconPlus width={14} /><span>Строка</span></button>
          {sc.columns.length < 8 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => upd('sizeChart', { ...sc, columns: [...sc.columns, 'Новый столбец'], rows: sc.rows.map((r) => [...r, '']) })}><IconPlus width={14} /><span>Столбец</span></button>}
          {sc.columns.length > 1 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => upd('sizeChart', { ...sc, columns: sc.columns.slice(0, -1), rows: sc.rows.map((r) => r.slice(0, -1)) })}><span>Убрать последний столбец</span></button>}
        </div>
        <F label="Примечание под таблицей"><input value={sc.note} onChange={(e) => upd('sizeChart', { ...sc, note: e.target.value })} maxLength={400} /></F>
      </section>
    </div>
  );
}
