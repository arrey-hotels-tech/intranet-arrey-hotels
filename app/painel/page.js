import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import KanbanBoard from './KanbanBoard';

export default async function PainelPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  let query = supabase
    .from('demands')
    .select('id, title, requester_info, priority, status, area_id, areas(name)')
    .eq('workspace_id', workspaceId)
    .neq('status', 'arquivado')
    .order('created_at', { ascending: false });

  if (session.role === 'gestor') {
    query = query.eq('area_id', session.areaId);
  }

  const { data: demands, error } = await query;

  if (error) {
    return <p className="error-text">Não foi possível carregar as demandas.</p>;
  }

  const editable = session.role === 'admin' || session.role === 'gestor';

  return (
    <div>
      {session.role === 'gestor' && (
        <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: 0 }}>
          Mostrando só a sua unidade.
        </p>
      )}
      {session.role === 'diretoria' && (
        <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: 0 }}>
          Todas as unidades, modo somente leitura.
        </p>
      )}
      <KanbanBoard initialDemands={demands || []} editable={editable} />
    </div>
  );
}
