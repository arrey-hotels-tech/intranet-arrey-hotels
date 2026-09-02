import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LogoutButton from './LogoutButton';

export default async function PainelLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const roleLabels = {
    admin: 'Márcio (admin)',
    gestor: 'Gestor',
    diretoria: 'Diretoria',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Painel</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: 0 }}>
            {roleLabels[session.role] || session.role}{session.name ? ` — ${session.name}` : ''}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="panel-nav">
        <a href="/painel">Kanban</a>
        {session.role === 'admin' && (
          <>
            <a href="/painel/pessoas">Pessoas</a>
            <a href="/painel/hoteis">Hotéis &amp; Áreas</a>
          </>
        )}
      </div>

      {children}
    </div>
  );
}
