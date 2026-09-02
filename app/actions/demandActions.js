'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { telegramSendMessage } from '@/lib/telegram';

export async function listAreas() {
  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const { data, error } = await supabase
    .from('areas')
    .select('name')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Erro ao listar áreas:', error);
    return [];
  }
  return (data || []).map((a) => a.name);
}

export async function createDemand(formData) {
  const supabase = supabaseAdmin();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID;

  const areaName = (formData.get('area') || '').toString().trim();
  const requesterInfo = (formData.get('quem') || '').toString().trim();
  const title = (formData.get('titulo') || '').toString().trim();
  const description = (formData.get('descricao') || '').toString().trim();
  const priority = (formData.get('prioridade') || 'media').toString();

  if (!areaName || !requesterInfo || !title || !description) {
    return { error: 'Preencha todos os campos obrigatórios.' };
  }
  if (!['baixa', 'media', 'alta'].includes(priority)) {
    return { error: 'Prioridade inválida.' };
  }

  const { data: area, error: areaError } = await supabase
    .from('areas')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', areaName)
    .maybeSingle();

  if (areaError || !area) {
    return { error: 'Hotel/área inválida.' };
  }

  const { data: demand, error } = await supabase
    .from('demands')
    .insert({
      workspace_id: workspaceId,
      area_id: area.id,
      requester_info: requesterInfo,
      title,
      description,
      priority,
      status: 'novo',
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar demanda:', error);
    return { error: 'Não foi possível salvar a demanda. Tente novamente.' };
  }

  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  await telegramSendMessage(
    adminChatId,
    `🆕 <b>Nova demanda #${demand.id}</b>\n${title}\n\nHotel: ${areaName}\nSolicitante: ${requesterInfo}\nPrioridade: ${priority}`
  );

  return { success: true, id: demand.id };
}
