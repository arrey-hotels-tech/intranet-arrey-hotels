'use client';

import { useState } from 'react';
import { updateDemandStatus } from '@/app/actions/painelActions';

const COLUMNS = [
  ['novo', 'Novo'],
  ['em_andamento', 'Em andamento'],
  ['aguardando', 'Aguardando'],
  ['concluido', 'Concluído'],
];

export default function KanbanBoard({ initialDemands, editable }) {
  const [demands, setDemands] = useState(initialDemands);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  function onDragStart(id) {
    if (!editable) return;
    setDragId(id);
  }

  function onDragOver(e, status) {
    if (!editable) return;
    e.preventDefault();
    setDragOverCol(status);
  }

  async function onDrop(status) {
    if (!editable || dragId == null) return;
    setDragOverCol(null);

    const prev = demands;
    setDemands((ds) => ds.map((d) => (d.id === dragId ? { ...d, status } : d)));

    const res = await updateDemandStatus(dragId, status);
    if (res.error) {
      setErrorMsg(res.error);
      setDemands(prev); // desfaz se o backend recusou
    } else {
      setErrorMsg('');
    }
    setDragId(null);
  }

  return (
    <div>
      {errorMsg && <p className="error-text">{errorMsg}</p>}
      <div className="kanban">
        {COLUMNS.map(([status, label]) => {
          const items = demands.filter((d) => d.status === status);
          return (
            <div
              key={status}
              className={`kcol${dragOverCol === status ? ' dragover' : ''}`}
              onDragOver={(e) => onDragOver(e, status)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDrop(status)}
            >
              <h4>{label} <span>{items.length}</span></h4>
              {items.map((d) => (
                <div
                  key={d.id}
                  className="kcard"
                  data-prio={d.priority}
                  draggable={editable}
                  onDragStart={() => onDragStart(d.id)}
                >
                  <div className="k-title">#{d.id} {d.title}</div>
                  <div className="k-meta">{d.areas?.name} · {(d.requester_info || '').split(',')[0]}</div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: '.75rem', color: 'var(--muted)', padding: '6px 4px' }}>Sem demandas</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
