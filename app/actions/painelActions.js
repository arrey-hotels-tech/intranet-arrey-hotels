'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSession } from '@/lib/session';
import { onlyDigits } from '@/lib/rand';

async function requireSession() {
  const session = await getSession();
  if (!session) return { session: null, error: 'Sessão expirada. Faça login novamente.' };
  return { session, error: null };
}

// ===== Kanban =====

export async function updateDemandStatus(demandId, newStatus) {
  const { session, error } = await requireSession();
  if (error) return { error };

  if (session.role === 'diretoria') {
    return { error: 'Diretoria tem acesso somente leitura.' };
  }

  const supabase = supabaseAdmin();

  if (session.role === 'gestor') {
    const { data: demand } = await supabase.from('demands').select('area_id').eq('id', demandId).single();
    if (!demand || demand.area_id !== session.areaId) {
      return { error: 'Você não tem permissão sobre essa demanda.' };
    }
  }

  const { data: current } = await supabase.from('demands').select('status').eq('id', demandId).single();

  const { error: updError } = await supabase
    .from('demands')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', demandId);

  if (updError) {
    console.error('Erro ao atualizar demanda:', updError);
    return { error: 'Não foi possível atualizar.' };
  }

  await supabase.from('demand_status_history').insert({
    demand_id: demandId,
    old_status: current?.status || null,
    new_status: newStatus,
  });

  return { success: true };
}

export async function archiveDemand(demandId) {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Só o admin pode arquivar.' };

  return updateDemandStatus(demandId, 'arquivado');
}

// ===== Pessoas (gestor/diretoria/colaborador) =====

export async function listEmployees() {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const { data, error: dbError } = await supabase
    .from('employees')
    .select('*, areas(name)')
    .eq('workspace_id', workspaceId)
    .order('name');

  if (dbError) {
    console.error('Erro ao listar pessoas:', dbError);
    return { error: 'Não foi possível carregar.' };
  }
  return { data };
}

export async function promoteEmployee(employeeId, role, areaName) {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };
  if (!['gestor', 'diretoria', 'colaborador'].includes(role)) return { error: 'Papel inválido.' };

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  let areaId = null;
  if (role === 'gestor') {
    if (!areaName) return { error: 'Selecione a unidade do gestor.' };
    const { data: area } = await supabase
      .from('areas')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', areaName)
      .maybeSingle();
    if (!area) return { error: 'Unidade não encontrada.' };
    areaId = area.id;
  }

  const { error: updError } = await supabase
    .from('employees')
    .update({ role, area_id: areaId })
    .eq('id', employeeId);

  if (updError) {
    console.error('Erro ao promover:', updError);
    return { error: 'Não foi possível atualizar.' };
  }
  return { success: true };
}

export async function createManualPerson(formData) {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const name = (formData.get('name') || '').toString().trim();
  const cpf = onlyDigits(formData.get('cpf'));
  const birthDate = (formData.get('birthDate') || '').toString();
  const role = (formData.get('role') || '').toString();
  const areaName = (formData.get('area') || '').toString();
  const phone = (formData.get('phone') || '').toString();

  if (!name || !cpf || !birthDate || !role) {
    return { error: 'Preencha nome, CPF, data de nascimento e papel.' };
  }

  let areaId = null;
  if (areaName) {
    const { data: area } = await supabase
      .from('areas')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', areaName)
      .maybeSingle();
    areaId = area?.id || null;
  }
  if (role === 'gestor' && !areaId) {
    return { error: 'Selecione a unidade do gestor.' };
  }

  const { error: insError } = await supabase.from('employees').insert({
    workspace_id: workspaceId,
    name,
    cpf,
    birth_date: birthDate,
    phone: phone || null,
    role,
    area_id: areaId,
    source: 'manual',
  });

  if (insError) {
    console.error('Erro ao cadastrar pessoa:', insError);
    if (insError.code === '23505') return { error: 'Já existe alguém cadastrado com esse CPF.' };
    return { error: 'Não foi possível cadastrar.' };
  }

  return { success: true };
}

// ===== Hotéis / áreas =====

export async function listAreasAdmin() {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const { data, error: dbError } = await supabase
    .from('areas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name');

  if (dbError) return { error: 'Não foi possível carregar.' };
  return { data };
}

export async function createArea(name) {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };
  if (!name || !name.trim()) return { error: 'Digite o nome do hotel/área.' };

  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const { error: insError } = await supabase.from('areas').insert({
    workspace_id: workspaceId,
    name: name.trim(),
    active: true,
  });
  if (insError) return { error: 'Não foi possível criar (nome já existe?).' };
  return { success: true };
}

export async function toggleArea(areaId, active) {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.role !== 'admin') return { error: 'Acesso negado.' };

  const supabase = supabaseAdmin();
  const { error: updError } = await supabase.from('areas').update({ active }).eq('id', areaId);
  if (updError) return { error: 'Não foi possível atualizar.' };
  return { success: true };
}
