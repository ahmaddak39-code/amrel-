import { useState } from 'react';
import { api } from '../lib/api.js';
import { LogoMark } from '../components/Logo.jsx';
import { Link } from '../lib/router.jsx';

export default function Login({ configured, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) { setError('Введите пароль'); return; }
    setBusy(true); setError('');
    try { await api('/api/admin/login', { method: 'POST', body: { password } }); onLogin(); }
    catch (err) { setError(err.message); setPassword(''); }
    finally { setBusy(false); }
  };

  return (
    <main className="login">
      <div className="login__glow" />
      <form className="login__box" onSubmit={submit}>
        <LogoMark className="login__mark" />
        <h1 className="login__title">Панель администратора</h1>
        <p className="login__sub">Доступ только для владельца магазина AMREL</p>
        {!configured ? (
          <div className="login__setup">
            <b>Пароль ещё не настроен на сервере.</b>
            <p>На компьютере: в папке проекта выполните в Терминале</p>
            <code>npm run set-password</code>
            <p>На Vercel: добавьте переменную ADMIN_PASSWORD_HASH в Settings → Environment Variables и сделайте Redeploy.</p>
          </div>
        ) : (
          <>
            <label className={`field ${error ? 'has-error' : ''}`}>
              <span className="field__label">Пароль</span>
              <span className="pwd">
                <input type={show ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" autoFocus />
                <button type="button" className="link-btn" onClick={() => setShow((s) => !s)}>{show ? 'Скрыть' : 'Показать'}</button>
              </span>
              <span className="field__error" role="alert">{error}</span>
            </label>
            <button className={`btn btn--accent btn--block ${busy ? 'is-loading' : ''}`} disabled={busy}><span>{busy ? 'Проверяем…' : 'Войти'}</span></button>
          </>
        )}
        <Link to="/" className="login__back">← Вернуться на сайт</Link>
      </form>
    </main>
  );
}
