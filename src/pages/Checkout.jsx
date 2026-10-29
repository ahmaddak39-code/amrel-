import { useState } from 'react';
import { useCart } from '../lib/cart.jsx';
import { useStore } from '../lib/store.jsx';
import { Link } from '../lib/router.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { rub, waLink, plural } from '../lib/format.js';
import { Reveal, SplitText } from '../lib/motion.jsx';
import { IconArrow, IconCheck } from '../components/Icons.jsx';

function Field({ label, error, children, wide }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${wide ? 'field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      <span className="field__error" role={error ? 'alert' : undefined}>{error || ''}</span>
    </label>
  );
}

function Success({ order, contacts }) {
  const text = [
    `Здравствуйте! Я оформил(а) заказ на сайте AMREL — ${order.number}.`,
    ...order.items.map((i) => `• ${i.name}, ${i.color}, ${i.size} × ${i.qty} — ${rub(i.price * i.qty)}`),
    `Итого: ${rub(order.total)}`,
  ].join('\n');
  return (
    <main className="page page--success">
      <div className="success">
        <span className="success__check"><IconCheck width={40} height={40} /></span>
        <Reveal variant="line" className="shead__meta"><span className="shead__idx">{order.number}</span><span className="shead__label">Заявка принята</span></Reveal>
        <SplitText as="h1" text="Спасибо за заказ" by="words" className="success__title" />
        <Reveal as="p" variant="up" delay={300} className="success__text">
          Мы получили вашу заявку на {rub(order.total)}. Менеджер свяжется с вами, чтобы подтвердить наличие, доставку и оплату.
          Чтобы ускорить подтверждение, отправьте заказ нам в WhatsApp.
        </Reveal>
        <Reveal variant="up" delay={450} className="success__ctas">
          {contacts?.whatsapp && <a className="btn btn--accent" href={waLink(contacts.whatsapp, text)} target="_blank" rel="noopener noreferrer"><span>Отправить заказ в WhatsApp</span><IconArrow width={18} /></a>}
          <Link to="/catalog" className="btn btn--ghost"><span>Продолжить покупки</span></Link>
        </Reveal>
      </div>
    </main>
  );
}

export default function Checkout() {
  const { lines, total, count, clear, hasProblems } = useCart();
  const { settings } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', delivery: 'pickup', city: '', address: '', comment: '', consent: false, website: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: '' })); };

  if (done) return <Success order={done} contacts={settings?.contacts} />;

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Укажите имя';
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Укажите телефон полностью';
    if (f.delivery === 'delivery' && !f.city.trim()) e.city = 'Укажите город';
    if (f.delivery === 'delivery' && !f.address.trim()) e.address = 'Укажите адрес';
    if (!f.consent) e.consent = 'Нужно ваше согласие';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) { toast.error('Проверьте поля формы'); return; }
    setSending(true);
    try {
      const res = await api('/api/orders', { method: 'POST', body: {
        customer: { name: f.name, phone: f.phone, delivery: f.delivery, city: f.city, address: f.address, comment: f.comment },
        consent: f.consent, website: f.website,
        items: lines.filter((l) => !l.problem).map((l) => ({ productId: l.productId, variantId: l.variantId, size: l.size, qty: l.qty })),
      } });
      setDone(res);
      clear();
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err.message);
    } finally { setSending(false); }
  };

  if (!lines.length) {
    return (
      <main className="page page--checkout">
        <div className="cat-empty">
          <SplitText as="h1" text="Корзина пуста" className="cat-empty__title" />
          <p className="muted">Добавьте товары, чтобы оформить заказ.</p>
          <Link to="/catalog" className="btn btn--light"><span>В каталог</span><IconArrow width={18} /></Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page page--checkout">
      <header className="co-head">
        <Reveal variant="line" className="shead__meta"><span className="shead__idx">AMREL</span><span className="shead__label">Оформление заказа</span></Reveal>
        <SplitText as="h1" text="Оформление" by="chars" stagger={35} className="co-head__title" />
      </header>
      <form className="co" onSubmit={submit} noValidate>
        <div className="co__form">
          <Reveal variant="up" className="co__block">
            <h2 className="co__h">01 · Контакты</h2>
            <div className="fields">
              <Field label="Имя *" error={errors.name}><input value={f.name} onChange={set('name')} autoComplete="name" maxLength={80} /></Field>
              <Field label="Телефон *" error={errors.phone}><input value={f.phone} onChange={set('phone')} type="tel" autoComplete="tel" placeholder="+7" maxLength={25} /></Field>
            </div>
          </Reveal>
          <Reveal variant="up" delay={120} className="co__block">
            <h2 className="co__h">02 · Получение</h2>
            <div className="seg" role="radiogroup" aria-label="Способ получения">
              {[['pickup', 'Самовывоз', settings?.contacts?.address], ['delivery', 'Доставка', 'Условия уточнит менеджер']].map(([v, l, d]) => (
                <label key={v} className={`seg__opt ${f.delivery === v ? 'is-active' : ''}`}>
                  <input type="radio" name="delivery" value={v} checked={f.delivery === v} onChange={set('delivery')} />
                  <b>{l}</b>{d && <span>{d}</span>}
                </label>
              ))}
            </div>
            <div className={`collapse ${f.delivery === 'delivery' ? 'is-open' : ''}`}>
              <div className="collapse__inner">
                <div className="fields">
                  <Field label="Город *" error={errors.city}><input value={f.city} onChange={set('city')} autoComplete="address-level2" maxLength={80} tabIndex={f.delivery === 'delivery' ? 0 : -1} /></Field>
                  <Field label="Адрес *" error={errors.address}><input value={f.address} onChange={set('address')} autoComplete="street-address" maxLength={300} tabIndex={f.delivery === 'delivery' ? 0 : -1} /></Field>
                </div>
              </div>
            </div>
            <Field label="Комментарий к заказу" wide><textarea value={f.comment} onChange={set('comment')} rows={3} maxLength={1000} /></Field>
            <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" />
          </Reveal>
          <Reveal variant="up" delay={200} className="co__block">
            <label className={`check ${errors.consent ? 'has-error' : ''}`}>
              <input type="checkbox" checked={f.consent} onChange={set('consent')} />
              <span className="check__box"><IconCheck width={14} /></span>
              <span>Согласен(на) на обработку персональных данных для оформления заказа</span>
            </label>
            {errors.consent && <span className="field__error">{errors.consent}</span>}
          </Reveal>
        </div>

        <Reveal as="aside" variant="right" delay={150} className="co__summary">
          <h2 className="co__h">Ваш заказ · {count} {plural(count, ['товар', 'товара', 'товаров'])}</h2>
          <ul className="co__items">
            {lines.map((l) => (
              <li key={l.key} className={l.problem ? 'has-problem' : ''}>
                {l.image && <img src={l.image} alt="" />}
                <div><b>{l.name}</b><span>{l.color} · {l.size} · {l.qty} шт.</span>{l.problem && <em>{l.problem}</em>}</div>
                <span>{l.price != null ? rub(l.sum) : '—'}</span>
              </li>
            ))}
          </ul>
          <div className="co__total"><span>Итого</span><strong>{rub(total)}</strong></div>
          <p className="co__note">Онлайн-оплата пока не подключена. Это заявка: менеджер свяжется с вами для подтверждения и оплаты.</p>
          <button type="submit" className={`btn btn--accent btn--block ${sending ? 'is-loading' : ''}`} disabled={sending || hasProblems || !total}>
            <span>{sending ? 'Отправляем…' : 'Отправить заявку'}</span>{!sending && <IconArrow width={18} />}
          </button>
          {hasProblems && <p className="drawer__warn">Удалите недоступные позиции в корзине.</p>}
        </Reveal>
      </form>
    </main>
  );
}
