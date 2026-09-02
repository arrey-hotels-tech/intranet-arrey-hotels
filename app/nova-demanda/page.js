'use client';

import { useEffect, useState } from 'react';
import { listAreas, createDemand } from '@/app/actions/demandActions';

export default function NovaDemandaPage() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    listAreas().then(setAreas);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.target);
    const res = await createDemand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult(res);
  }

  if (result) {
    return (
      <div className="card confirm-box">
        <div className="badge">✓</div>
        <h2>Demanda registrada!</h2>
        <p style={{ color: 'var(--muted)' }}>
          Nº #{result.id} · o time de tecnologia foi avisado agora mesmo.
        </p>
        <a className="btn secondary" href="/" style={{ marginTop: 14, display: 'inline-block' }}>
          Voltar para a home
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2>Abrir chamado</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Sem necessidade de login.</p>
      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label>Hotel / Área</label>
          <select name="area" required>
            <option value="">Selecione…</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quem está solicitando</label>
          <input name="quem" type="text" placeholder="Ex: Maria Silva, recepção, (86) 99999-9999" required />
        </div>
        <div className="field">
          <label>Título da demanda</label>
          <input name="titulo" type="text" placeholder="Ex: Ar-condicionado do salão não liga" required />
        </div>
        <div className="field">
          <label>Descrição</label>
          <textarea name="descricao" placeholder="Descreva o que está acontecendo" required></textarea>
        </div>
        <div className="field">
          <label>Prioridade percebida</label>
          <select name="prioridade" defaultValue="media">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar demanda'}
        </button>
      </form>
    </div>
  );
}
