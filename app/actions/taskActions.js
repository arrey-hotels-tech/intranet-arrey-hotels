'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';
import { getDefaultWorkspaceId, logDatabaseError } from '@/lib/workspace';

const ALLOWED_ROLES = ['admin', 'diretoria', 'gestor'];
const STATUSES = ['novo', 'em_andamento', 'aguardando', 'concluido'];
const PRIORITIES = ['baixa', 'media', 'alta'];

function actorFromSession(session) {
  return { type: session.role === 'admin' ? 'admin' : 'employee', id: session.id };
}

async function requireTaskSession() {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return { error: 'Sessão expirada ou acesso negado.' };
  }
  return { session };
}

async function getActiveEmployees(supabase, workspaceId, ids = null) {
  let query = supabase
    .from('employees')
    .select('id, name, role, area_id, areas(name)')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .in('role', ['diretoria', 'gestor']);
  if (ids) query = query.in('id', ids);
  return query.order('name');
}

function mayAssign(session, employee) {
  if (session.role === 'admin') return ['diretoria', 'gestor'].includes(employee.role);
  if (session.role === 'diretoria') return employee.role === 'gestor';
  return false;
}

function mayInvite(session, employee, participationRole) {
  if (session.role === 'admin') return true;
  if (session.role === 'diretoria') return employee.role === 'gestor' || participationRole === 'acompanhante';
  return session.role === 'gestor' && participationRole === 'acompanhante' && employee.role === 'diretoria';
}

export async function listTaskPeople() {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };

  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();
  const { data, error } = await getActiveEmployees(supabase, workspaceId);
  if (error) {
    logDatabaseError('Falha ao listar pessoas disponíveis para tarefas', error);
    return { error: 'Não foi possível carregar as pessoas.' };
  }

  return {
    data: data.map((person) => ({
      ...person,
      canAssign: mayAssign(auth.session, person),
      canExecute: mayInvite(auth.session, person, 'executor'),
      canFollow: mayInvite(auth.session, person, 'acompanhante'),
    })),
  };
}

export async function listInternalTasks() {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };

  const { session } = auth;
  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();
  const actor = actorFromSession(session);
  let participantTaskIds = [];

  if (actor.type === 'employee') {
    const { data: memberships, error: membershipError } = await supabase
      .from('internal_task_participants')
      .select('task_id')
      .eq('employee_id', actor.id);
    if (membershipError) {
      logDatabaseError('Falha ao consultar participações em tarefas', membershipError);
      return { error: 'Não foi possível carregar as tarefas.' };
    }
    participantTaskIds = memberships.map((item) => item.task_id);
  }

  let taskQuery = supabase
    .from('internal_tasks')
    .select('id, creator_type, creator_id, assignee_type, assignee_id, title, description, priority, status, due_date, created_at')
    .eq('workspace_id', workspaceId)
    .neq('status', 'arquivado')
    .order('created_at', { ascending: false });

  if (session.role !== 'admin') {
    const filters = [
      `and(creator_type.eq.${actor.type},creator_id.eq.${actor.id})`,
      `and(assignee_type.eq.${actor.type},assignee_id.eq.${actor.id})`,
    ];
    if (participantTaskIds.length) filters.push(`id.in.(${participantTaskIds.join(',')})`);
    taskQuery = taskQuery.or(filters.join(','));
  }

  const { data: tasks, error: taskError } = await taskQuery;
  if (taskError) {
    logDatabaseError('Falha ao listar tarefas internas', taskError);
    return { error: 'Não foi possível carregar as tarefas.' };
  }
  if (!tasks.length) return { data: [] };

  const taskIds = tasks.map((task) => task.id);
  const { data: participants, error: participantError } = await supabase
    .from('internal_task_participants')
    .select('id, task_id, employee_id, participation_role, invitation_status')
    .in('task_id', taskIds);
  if (participantError) {
    logDatabaseError('Falha ao listar participantes das tarefas', participantError);
    return { error: 'Não foi possível carregar as tarefas.' };
  }

  const employeeIds = [...new Set([
    ...tasks.flatMap((task) => [task.creator_type === 'employee' ? task.creator_id : null, task.assignee_type === 'employee' ? task.assignee_id : null]),
    ...participants.map((participant) => participant.employee_id),
  ].filter(Boolean))];
  const { data: employees, error: employeeError } = employeeIds.length
    ? await getActiveEmployees(supabase, workspaceId, employeeIds)
    : { data: [], error: null };
  if (employeeError) {
    logDatabaseError('Falha ao identificar participantes das tarefas', employeeError);
    return { error: 'Não foi possível carregar as tarefas.' };
  }

  const names = new Map(employees.map((employee) => [employee.id, employee.name]));
  const actorName = (type, id) => type === 'admin' ? 'Admin-master' : names.get(id) || 'Pessoa inativa';
  return {
    data: tasks.map((task) => {
      const taskParticipants = participants.filter((participant) => participant.task_id === task.id);
      const ownParticipant = actor.type === 'employee'
        ? taskParticipants.find((participant) => participant.employee_id === actor.id)
        : null;
      const canEdit = session.role === 'admin'
        || (task.creator_type === actor.type && task.creator_id === actor.id)
        || (task.assignee_type === actor.type && task.assignee_id === actor.id)
        || (ownParticipant?.participation_role === 'executor' && ownParticipant.invitation_status === 'aceito');
      const isCreator = task.creator_type === actor.type && task.creator_id === actor.id;
      return {
        ...task,
        creatorName: actorName(task.creator_type, task.creator_id),
        assigneeName: actorName(task.assignee_type, task.assignee_id),
        participants: taskParticipants.map((participant) => ({ ...participant, name: names.get(participant.employee_id) || 'Pessoa inativa' })),
        pendingInvitationId: ownParticipant?.invitation_status === 'pendente' ? ownParticipant.id : null,
        pendingInvitationRole: ownParticipant?.invitation_status === 'pendente' ? ownParticipant.participation_role : null,
        canEdit,
        canArchive: session.role === 'admin' || isCreator,
        canDelete: session.role === 'admin' || isCreator,
      };
    }),
  };
}

export async function createInternalTask(formData) {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;
  const actor = actorFromSession(session);
  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();

  const title = (formData.get('title') || '').toString().trim();
  const description = (formData.get('description') || '').toString().trim();
  const priority = (formData.get('priority') || 'media').toString();
  const dueDate = (formData.get('dueDate') || '').toString() || null;
  const assigneeValue = (formData.get('assignee') || 'self').toString();
  const executorIds = [...new Set(formData.getAll('executors').map(String))];
  const followerIds = [...new Set(formData.getAll('followers').map(String))];

  if (!title) return { error: 'Digite o título da tarefa.' };
  if (!PRIORITIES.includes(priority)) return { error: 'Prioridade inválida.' };

  let assignee = actor;
  const requestedEmployeeIds = [...new Set([
    ...(assigneeValue !== 'self' ? [assigneeValue] : []),
    ...executorIds,
    ...followerIds,
  ])];
  const { data: requestedEmployees, error: employeeError } = requestedEmployeeIds.length
    ? await getActiveEmployees(supabase, workspaceId, requestedEmployeeIds)
    : { data: [], error: null };
  if (employeeError || requestedEmployees.length !== requestedEmployeeIds.length) {
    if (employeeError) logDatabaseError('Falha ao validar pessoas da tarefa', employeeError);
    return { error: 'Uma das pessoas selecionadas é inválida.' };
  }
  const employeesById = new Map(requestedEmployees.map((employee) => [employee.id, employee]));

  if (assigneeValue !== 'self') {
    const employee = employeesById.get(assigneeValue);
    if (!employee || !mayAssign(session, employee)) return { error: 'Você não pode atribuir a tarefa a essa pessoa.' };
    assignee = { type: 'employee', id: employee.id };
  }
  if (session.role === 'gestor' && assigneeValue !== 'self') return { error: 'Gestores só podem criar tarefas para si.' };

  for (const id of executorIds) {
    if (!mayInvite(session, employeesById.get(id), 'executor')) return { error: 'Executor não permitido.' };
  }
  for (const id of followerIds) {
    if (!mayInvite(session, employeesById.get(id), 'acompanhante')) return { error: 'Acompanhante não permitido.' };
  }

  const { data: task, error: taskError } = await supabase
    .from('internal_tasks')
    .insert({
      workspace_id: workspaceId,
      creator_type: actor.type,
      creator_id: actor.id,
      assignee_type: assignee.type,
      assignee_id: assignee.id,
      title,
      description: description || null,
      priority,
      due_date: dueDate,
    })
    .select('id')
    .single();
  if (taskError) {
    logDatabaseError('Falha ao criar tarefa interna', taskError);
    return { error: 'Não foi possível criar a tarefa.' };
  }

  const participantRows = [
    ...executorIds.map((employeeId) => ({ task_id: task.id, employee_id: employeeId, participation_role: 'executor', invitation_status: employeeId === actor.id ? 'aceito' : 'pendente' })),
    ...followerIds.map((employeeId) => ({ task_id: task.id, employee_id: employeeId, participation_role: 'acompanhante', invitation_status: employeeId === actor.id ? 'aceito' : 'pendente' })),
  ].filter((participant, index, rows) => rows.findIndex((item) => item.employee_id === participant.employee_id && item.participation_role === participant.participation_role) === index)
    .filter((participant) => !(assignee.type === 'employee' && participant.employee_id === assignee.id && participant.participation_role === 'executor'));

  if (participantRows.length) {
    const { error: participantError } = await supabase.from('internal_task_participants').insert(participantRows);
    if (participantError) {
      logDatabaseError('Falha ao adicionar participantes à tarefa', participantError);
      await supabase.from('internal_tasks').delete().eq('id', task.id);
      return { error: 'Não foi possível adicionar os participantes.' };
    }
  }

  revalidatePath('/painel');
  return { success: true };
}

export async function updateInternalTaskStatus(taskId, status) {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };
  if (!STATUSES.includes(status)) return { error: 'Status inválido.' };
  const { session } = auth;
  const actor = actorFromSession(session);
  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();

  const { data: task, error: taskError } = await supabase
    .from('internal_tasks')
    .select('creator_type, creator_id, assignee_type, assignee_id')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (taskError || !task) return { error: 'Tarefa não encontrada.' };

  let allowed = session.role === 'admin'
    || (task.creator_type === actor.type && task.creator_id === actor.id)
    || (task.assignee_type === actor.type && task.assignee_id === actor.id);
  if (!allowed && actor.type === 'employee') {
    const { data: executor } = await supabase
      .from('internal_task_participants')
      .select('id')
      .eq('task_id', taskId)
      .eq('employee_id', actor.id)
      .eq('participation_role', 'executor')
      .eq('invitation_status', 'aceito')
      .maybeSingle();
    allowed = Boolean(executor);
  }
  if (!allowed) return { error: 'Você não pode alterar esta tarefa.' };

  const { error } = await supabase
    .from('internal_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('workspace_id', workspaceId);
  if (error) {
    logDatabaseError('Falha ao atualizar tarefa interna', error);
    return { error: 'Não foi possível atualizar a tarefa.' };
  }
  revalidatePath('/painel');
  return { success: true };
}

export async function archiveInternalTask(taskId) {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;
  const actor = actorFromSession(session);
  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();

  const { data: task, error: findError } = await supabase
    .from('internal_tasks')
    .select('creator_type, creator_id')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (findError) {
    logDatabaseError('Falha ao localizar tarefa para arquivamento', findError);
    return { error: 'Não foi possível arquivar a tarefa.' };
  }
  if (!task) return { error: 'Tarefa não encontrada.' };
  const isCreator = task.creator_type === actor.type && task.creator_id === actor.id;
  if (session.role !== 'admin' && !isCreator) return { error: 'Somente o criador pode arquivar esta tarefa.' };

  const { error } = await supabase
    .from('internal_tasks')
    .update({ status: 'arquivado', updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('workspace_id', workspaceId);
  if (error) {
    logDatabaseError('Falha ao arquivar tarefa interna', error);
    return { error: 'Não foi possível arquivar a tarefa.' };
  }
  revalidatePath('/painel');
  return { success: true };
}

export async function deleteInternalTask(taskId) {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };
  const { session } = auth;
  const actor = actorFromSession(session);
  const workspaceId = getDefaultWorkspaceId();
  const supabase = supabaseAdmin();

  const { data: task, error: findError } = await supabase
    .from('internal_tasks')
    .select('creator_type, creator_id')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (findError) {
    logDatabaseError('Falha ao localizar tarefa para exclusão', findError);
    return { error: 'Não foi possível excluir a tarefa.' };
  }
  if (!task) return { error: 'Tarefa não encontrada.' };
  const isCreator = task.creator_type === actor.type && task.creator_id === actor.id;
  if (session.role !== 'admin' && !isCreator) return { error: 'Somente o criador pode excluir esta tarefa.' };

  const { error } = await supabase
    .from('internal_tasks')
    .delete()
    .eq('id', taskId)
    .eq('workspace_id', workspaceId);
  if (error) {
    logDatabaseError('Falha ao excluir tarefa interna', error);
    return { error: 'Não foi possível excluir a tarefa.' };
  }
  revalidatePath('/painel');
  return { success: true };
}

export async function acceptTaskInvitation(participantId) {
  const auth = await requireTaskSession();
  if (auth.error) return { error: auth.error };
  if (auth.session.role === 'admin') return { error: 'Convite inválido.' };
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('internal_task_participants')
    .update({ invitation_status: 'aceito' })
    .eq('id', participantId)
    .eq('employee_id', auth.session.id)
    .eq('invitation_status', 'pendente')
    .select('id')
    .maybeSingle();
  if (error) {
    logDatabaseError('Falha ao aceitar convite de tarefa', error);
    return { error: 'Não foi possível aceitar o convite.' };
  }
  if (!data) return { error: 'Convite não encontrado ou já respondido.' };
  revalidatePath('/painel');
  return { success: true };
}
