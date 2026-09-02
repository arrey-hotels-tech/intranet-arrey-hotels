'use client';

import { useEffect, useState } from 'react';
import { listAreasAdmin, createArea, toggleArea } from '@/app/actions/painelActions';

export default function HoteisPage() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await listAreasAdmin();
    if (res.error) setError(res.error);
    else setAreas(res.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    const res = await createArea(newName);
    if (res.error) { setError(res.error); return; }
    setNewName('');
    load();
  }

  async function handleToggle(id, active) {
    await toggleArea(id, !active);
    load();
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, margin: '20px 0', maxWidth: 420 }}>
        <input type="text" placeholder="Nome do novo hotel/área" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn small" type="submit">Adicionar</button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <table>
        <thead><tr><th>Unidade</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.active ? 'Ativa' : 'Inativa'}</td>
              <td>
                <button className="btn ghost small" onClick={() => handleToggle(a.id, a.active)}>
                  {a.active ? 'Desativar' : 'Ativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
