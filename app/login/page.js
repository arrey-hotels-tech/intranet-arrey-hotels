'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { identify, checkLinked, verifyCode, adminLogin } from '@/app/actions/authActions';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('pessoa'); // 'pessoa' | 'admin'
  const [step, setStep] = useState('cpf'); // cpf | link | code
  const [needBirth, setNeedBirth] = useState(false);
  const [link, setLink] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleIdentify(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.target);
    const res = await identify(formData);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      if (res.needBirthDate) setNeedBirth(true);
      return;
    }
    if (res.needBirthDate) {
      setNeedBirth(true);
      return;
    }
    if (res.step === 'link') {
      setLink(res.link);
      setEmployeeId(res.employeeId);
      setStep('link');
    }
    if (res.step === 'code') {
      setEmployeeId(res.employeeId);
      setStep('code');
    }
  }

  async function handleCheckLinked() {
    setLoading(true);
    setError('');
    const res = await checkLinked(employeeId);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if (res.linked === false) {
      setError('Ainda não detectamos o vínculo. Confirme que você apertou "Iniciar" no Telegram.');
      return;
    }
    setStep('code');
  }

  async function handleVerify(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.target);
    formData.set('employeeId', employeeId);
    const res = await verifyCode(formData);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    router.push('/painel');
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.target);
    const res = await adminLogin(formData);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    router.push('/painel');
  }

  return (
    <div className="login-shell">
      <h2 style={{ fontSize: '1.3rem' }}>Entrar no painel</h2>

      <div className="tab-switch">
        <button className={mode === 'pessoa' ? 'active' : ''} onClick={() => { setMode('pessoa'); setError(''); }}>
          Gestor / Diretoria
        </button>
        <button className={mode === 'admin' ? 'active' : ''} onClick={() => { setMode('admin'); setError(''); }}>
          Admin
        </button>
      </div>

      {mode === 'admin' && (
        <form className="card" onSubmit={handleAdminLogin}>
          <div className="field">
            <label>E-mail</label>
            <input name="email" type="email" required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input name="password" type="password" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}

      {mode === 'pessoa' && step === 'cpf' && (
        <form className="card" onSubmit={handleIdentify}>
          <div className="field">
            <label>CPF</label>
            <input name="cpf" type="text" placeholder="000.000.000-00" required />
          </div>
          {needBirth && (
            <div className="field">
              <label>Data de nascimento <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(só no 1º acesso)</span></label>
              <input name="birthDate" type="date" required />
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Verificando…' : 'Continuar'}
          </button>
        </form>
      )}

      {mode === 'pessoa' && step === 'link' && (
        <div className="card">
          <p style={{ fontSize: '.9rem' }}>Vincule sua conta do Telegram pra receber o código de acesso:</p>
          <a className="btn secondary" href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 14 }}>
            Abrir no Telegram
          </a>
          {error && <p className="error-text">{error}</p>}
          <div>
            <button className="btn" onClick={handleCheckLinked} disabled={loading}>
              {loading ? 'Verificando…' : 'Já vinculei'}
            </button>
          </div>
        </div>
      )}

      {mode === 'pessoa' && step === 'code' && (
        <form className="card" onSubmit={handleVerify}>
          <p style={{ fontSize: '.9rem' }}>Digite o código enviado no Telegram:</p>
          <div className="field">
            <input name="code" type="text" placeholder="000000" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
