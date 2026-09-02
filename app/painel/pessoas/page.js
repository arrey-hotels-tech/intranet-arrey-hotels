'use client';

import { useEffect, useState } from 'react';
import { listEmployees, promoteEmployee, createManualPerson } from '@/app/actions/painelActions';
import { listAreasAdmin } from '@/app/actions/painelActions';

export default function PessoasPage() {
  const [people, setPeople] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [peopleRes, areasRes] = await Promise.all([listEmployees(), listAreasAdmin()]);
    if (peopleRes.error) setError(peopleRes.error);
    else setPeople(peopleRes.data || []);
    if (areasRes.data) setAreas(areasRes.data.filter((a) => a.active).map((a) => a.name));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handlePromote(id, role) {
    let areaName = null;
    if (role === 'gestor') {
      areaName = window.prompt('Digite o nome exato da unidade (ex: Gran, Executive):');
      if (!areaName) return;
    }
    const res = await promoteEmployee(id, role, areaName);
    if (res.error) { alert(res.error); return; }
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const formData = new FormData(e.target);
    const res = await createManualPerson(formData);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setShowForm(false);
    e.target.reset();
    load();
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: 0 }}>
          Gestores e diretoria — cadastro manual. Colaboradores virão da planilha de RH (sincronização a implementar na Fase 2).
        </p>
        <button className="btn small" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Cadastrar pessoa'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <div className="field"><label>Nome</label><input name="name" type="text" required /></div>
          <div className="field"><label>CPF</label><input name="cpf" type="text" required /></div>
          <div className="field"><label>Data de nascimento</label><input name="birthDate" type="date" required /></div>
          <div className="field"><label>Telefone (opcional)</label><input name="phone" type="text" /></div>
          <div className="field">
            <label>Papel</label>
            <select name="role" required>
              <option value="gestor">Gestor</option>
              <option value="diretoria">Diretoria</option>
              <option value="colaborador">Colaborador</option>
            </select>
          </div>
          <div className="field">
            <label>Unidade (obrigatório se for gestor)</label>
            <select name="area">
              <option value="">—</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar'}</button>
        </form>
      )}

      <table>
        <thead>
          <tr><th>Nome</th><th>Unidade</th><th>Papel</th><th></th></tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.areas?.name || '—'}</td>
              <td><span className={`role-tag ${p.role}`}>{p.role}</span></td>
              <td>
                {p.role !== 'gestor' && <button className="btn ghost small" onClick={() => handlePromote(p.id, 'gestor')}>Tornar gestor</button>}
                {' '}
                {p.role !== 'diretoria' && <button className="btn ghost small" onClick={() => handlePromote(p.id, 'diretoria')}>Tornar diretoria</button>}
              </td>
            </tr>
          ))}
          {people.length === 0 && (
            <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>Nenhuma pessoa cadastrada ainda.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
