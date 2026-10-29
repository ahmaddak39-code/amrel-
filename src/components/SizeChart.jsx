import Modal from './Modal.jsx';
import { useStore } from '../lib/store.jsx';

export default function SizeChart({ open, onClose }) {
  const { settings } = useStore();
  const sc = settings?.sizeChart;
  return (
    <Modal open={open} onClose={onClose} title="Таблица размеров">
      {sc?.rows?.length ? (
        <>
          <div className="table-wrap">
            <table className="sctable">
              <thead><tr>{sc.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>{sc.rows.map((r, i) => <tr key={i} style={{ '--i': i }}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {sc.note && <p className="sctable__note">{sc.note}</p>}
        </>
      ) : <p className="muted">Таблица размеров пока не заполнена. Уточните замеры у менеджера в WhatsApp.</p>}
    </Modal>
  );
}
