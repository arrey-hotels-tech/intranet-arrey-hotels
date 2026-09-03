import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getDefaultWorkspaceId, logDatabaseError } from '@/lib/workspace';
import { listInternalTasks, listTaskPeople } from '@/app/actions/taskActions';
import KanbanBoard from './KanbanBoard';

export default async function PainelPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = supabaseAdmin();
  const workspaceId = getDefaultWorkspaceId();
  let demandQuery = supabase
    .from('demands')
    .select('id, title, requester_info, priority, status, area_id, areas(name)')
    .eq('workspace_id', workspaceId)
    .neq('status', 'arquivado')
    .order('created_at', { ascending: false });

  if (session.role === 'gestor') demandQuery = demandQuery.eq('area_id', session.areaId);

  const [{ data: demands, error: demandError }, taskResult, peopleResult] = await Promise.all([
    demandQuery,
    listInternalTasks(),
    listTaskPeople(),
  ]);

  if (demandError) logDatabaseError('Falha ao carregar demandas do Kanban', demandError);
  const loadError = demandError || taskResult.error || peopleResult.error;
  const demandEditable = session.role === 'admin' || session.role === 'gestor';
  const items = [
    ...((demands || []).map((demand) => ({
      ...demand,
      kind: 'demand',
      boardKey: `demand:${demand.id}`,
      canEdit: demandEditable,
      canArchive: session.role === 'admin',
      canDelete: session.role === 'admin',
      sourceLabel: 'Demanda externa',
      primaryName: demand.areas?.name || 'Sem unidade',
      secondaryName: (demand.requester_info || '').split(',')[0],
    }))),
    ...((taskResult.data || []).map((task) => ({
      ...task,
      kind: 'task',
      boardKey: `task:${task.id}`,
      sourceLabel: 'Tarefa interna',
      primaryName: task.assigneeName,
      secondaryName: task.due_date ? `Prazo ${new Date(`${task.due_date}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Sem prazo',
    }))),
  ];

  return (
    <div>
      {loadError && <p className="error-text">Parte do Kanban não pôde ser carregada. Consulte os logs do servidor.</p>}
      <p className="panel-hint">
        Demandas externas e tarefas internas aparecem juntas. Tarefas particulares só são vistas por seus participantes.
      </p>
      <KanbanBoard initialItems={items} people={peopleResult.data || []} role={session.role} />
    </div>
  );
}
