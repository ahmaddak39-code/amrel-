import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { PageHead } from './ui.jsx';

function strength(p) {
  let s = 0;
  if (p.length >= 10) s++; if (p.length >= 14) s++;
  if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) s++;
  if (/\d/.test(p)) s++; if (/[^A-Za-zА-Яа-я0-9]/.test(p)) s++;
  return Math.min(4, s);
}
const LABELS = ['Слишком простой', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];

export default function Security({ guard, storage }) {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);
  useEffect(() => { api('/api/admin/health').then(setHealth).catch((e) => { if (!guard(e)) setHealth({ error: e.message }); }); }, [guard]);

  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr(''); };
  const st = strength(f.next);
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.again) { setErr('Новые пароли не совпадают'); return; }
    setBusy(true);
    try {
      await api('/api/admin/password', { method: 'POST', body: { current: f.current, next: f.next } });
      setF({ current: '', next: '', again: '' });
      toast.success('Пароль изменён. Вход на других устройствах завершён');
    } catch (ex) { if (!guard(ex)) setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="adm-page">
      <PageHead title="Пароль и доступ" sub="Смена пароля администратора и состояние хранилища" />
      <div className="adm-alert">
        <b>Рекомендация:</b> начальный пароль упоминался в переписке. Смените его здесь перед тем, как давать ссылку на сайт покупателям.
      </div>
      <div className="adm-grid">
        <form className="adm-card" onSubmit={submit}>
          <h3>Сменить пароль</h3>
          <label className="field field--wide"><span className="field__label">Текущий пароль</span>
            <input id="pw-current" type="password" value={f.current} onChange={set('current')} autoComplete="current-password" required /></label>
          <label className="field field--wide"><span className="field__label">Новый пароль (от 10 символов, буквы и цифры)</span>
            <input id="pw-next" type="password" value={f.next} onChange={set('next')} autoComplete="new-password" required /></label>
          {f.next && (
            <div className={`pwmeter pwmeter--${st}`}><span style={{ width: `${(st + 1) * 20}%` }} /><small>{LABELS[st]}</small></div>
          )}
          <label className="field field--wide"><span className="field__label">Повторите новый пароль</span>
            <input id="pw-again" type="password" value={f.again} onChange={set('again')} autoComplete="new-password" required /></label>
          {err && <p className="field__error" role="alert">{err}</p>}
          <button className="btn btn--accent btn--sm" disabled={busy || !f.current || !f.next}><span>{busy ? 'Сохраняем…' : 'Сменить пароль'}</span></button>
          <p className="adm-hint">Новый пароль хранится на сервере только в зашифрованном виде (хеш). После смены все остальные устройства выйдут из панели.</p>
        </form>
        <section className="adm-card">
          <h3>Хранилище</h3>
          <p className="muted">{storage === 'supabase' ? 'Облако Supabase: товары и заказы в базе данных, фото в облачном хранилище.' : 'Локальная папка data/ на этом компьютере.'}</p>
          {health && !health.error && (
            <ul className="health">
              <li className={health.database ? 'ok' : 'bad'}>База данных: {health.database ? 'работает' : 'нет связи'}</li>
              <li className={health.storage ? 'ok' : 'bad'}>Хранилище фото: {health.storage ? 'работает' : 'нет связи'}</li>
              {health.databaseError && <li className="bad">{health.databaseError}</li>}
              {health.storageError && <li className="bad">{health.storageError}</li>}
            </ul>
          )}
          {health?.error && <p className="field__error">{health.error}</p>}
        </section>
      </div>
    </div>
  );
}
