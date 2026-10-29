import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { rub, waLink, telLink } from '../lib/format.js';
import { PageHead } from './ui.jsx';

export const STATUSES = { new: 'Новый', confirmed: 'Подтверждён', shipped: 'Отправлен', completed: 'Выполнен', cancelled: 'Отменён' };

export default function Orders({ guard, onChanged }) {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    try { setOrders(await api('/api/admin/orders')); } catch (e) { if (!guard(e)) toast.error(e.message); }
  }, [guard, toast]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (o, status) => {
    try { await api(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status } }); toast.success(`${o.number}: ${STATUSES[status]}`); load(); onChanged(); }
    catch (e) { if (!guard(e)) toast.error(e.message); }
  };

  if (!orders) return <div className="adm-loading">Загрузка…</div>;
  const list = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  return (
    <div className="adm-page">
      <PageHead title="Заказы" sub="Заявки с сайта. Онлайн-оплата не подключена — подтверждайте заказ с клиентом по телефону или WhatsApp" />
      <div className="tabs tabs--sm">
        {[['all', 'Все'], ...Object.entries(STATUSES)].map(([k, l]) => (
          <button key={k} className={`tab ${filter === k ? 'is-active' : ''}`} onClick={() => setFilter(k)}>
            {l}<sup>{k === 'all' ? orders.length : orders.filter((o) => o.status === k).length}</sup>
          </button>
        ))}
      </div>
      {!list.length ? <p className="muted adm-empty">Заказов пока нет.</p> : (
        <div className="orders">
          {list.map((o) => (
            <div key={o.id} className={`order order--${o.status} ${open === o.id ? 'is-open' : ''}`}>
              <button className="order__head" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                <b>{o.number}</b>
                <span>{new Date(o.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span>{o.customer.name}</span>
                <span>{rub(o.total)}</span>
                <span className={`status status--${o.status}`}>{STATUSES[o.status]}</span>
              </button>
              <div className="acc__panel"><div className="acc__inner">
                <div className="order__body">
                  <div>
                    <h4>Покупатель</h4>
                    <p>{o.customer.name}<br /><a href={telLink(o.customer.phone)}>{o.customer.phone}</a>
                      {' · '}<a href={waLink(o.customer.phone, `Здравствуйте, ${o.customer.name}! Это AMREL, по вашему заказу ${o.number}.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
                    <p>{o.customer.delivery === 'delivery' ? `Доставка: ${o.customer.city}, ${o.customer.address}` : 'Самовывоз'}</p>
                    {o.customer.comment && <p className="muted">«{o.customer.comment}»</p>}
                  </div>
                  <div>
                    <h4>Состав</h4>
                    <ul className="order__items">
                      {o.items.map((it, i) => (
                        <li key={i}>{it.image && <img src={it.image} alt="" />}<span>{it.name}<small>{it.color} · {it.size} · {it.qty} шт. × {rub(it.price)}</small></span><b>{rub(it.price * it.qty)}</b></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Статус</h4>
                    <div className="order__statuses">
                      {Object.entries(STATUSES).map(([k, l]) => (
                        <button key={k} className={`chip ${o.status === k ? 'is-on' : ''}`} onClick={() => setStatus(o, k)} disabled={o.status === k}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
