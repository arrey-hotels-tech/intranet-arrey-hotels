'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { listAreas, createDemand } from '@/app/actions/demandActions';
import { confirmUploads } from '@/app/actions/mediaActions';

const TURNSTILE_SITE_KEY = process.env.NODE_ENV === 'production'
  ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  : '1x00000000000000000000AA';

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
    const form = e.currentTarget;
    const files = [...(form.querySelector('[data-attachments]')?.files || [])];
    setLoading(true);
    setError('');
    const formData = new FormData(form);
    formData.set('attachments', JSON.stringify(files.map((file) => ({ name: file.name, type: file.type, size: file.size }))));
    const res = await createDemand(formData);
    if (res.error) {
      setLoading(false);
      window.turnstile?.reset();
      setError(res.error);
      return;
    }
    try {
      await Promise.all((res.uploads || []).map(async (upload, index) => {
        const response = await fetch(upload.url, { method: 'PUT', headers: { 'Content-Type': upload.contentType }, body: files[index] });
        if (!response.ok) throw new Error('Falha no upload');
      }));
      const confirmation = await confirmUploads((res.uploads || []).map(({ id, token }) => ({ id, token })));
      if (confirmation.error) throw new Error(confirmation.error);
    } catch {
      setLoading(false);
      setError(`O chamado #${res.id} foi criado, mas um anexo não foi enviado. Avise a equipe de tecnologia.`);
      return;
    }
    setLoading(false);
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
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
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
        <div className="field">
          <label>Fotos, vídeos ou PDF (opcional, até 5 arquivos)</label>
          <input data-attachments type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,video/mp4,video/quicktime,video/webm" />
          <p className="form-help">Fotos/PDF até 15 MB; vídeos até 100 MB; total máximo de 200 MB.</p>
        </div>
        <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-theme="light"></div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar demanda'}
        </button>
      </form>
    </div>
  );
}
