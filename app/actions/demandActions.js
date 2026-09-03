'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { telegramSendMessage } from '@/lib/telegram';
import { getDefaultWorkspaceId } from '@/lib/workspace';
import { parseAndValidateFiles, prepareMediaUploads } from '@/lib/media';
import { verifyTurnstile } from '@/lib/turnstile';

export async function listAreas() {
  const supabase = supabaseAdmin();
  const workspaceId = getDefaultWorkspaceId();

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
  const workspaceId = getDefaultWorkspaceId();

  const areaName = (formData.get('area') || '').toString().trim();
  const requesterInfo = (formData.get('quem') || '').toString().trim();
  const title = (formData.get('titulo') || '').toString().trim();
  const description = (formData.get('descricao') || '').toString().trim();
  const priority = (formData.get('prioridade') || 'media').toString();
  const fileResult = parseAndValidateFiles((formData.get('attachments') || '[]').toString());
  if (fileResult.error) return { error: fileResult.error };
  if (!await verifyTurnstile((formData.get('cf-turnstile-response') || '').toString())) {
    return { error: 'Não foi possível confirmar que você é uma pessoa. Tente novamente.' };
  }

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

  const mediaResult = await prepareMediaUploads({
    workspaceId,
    entityType: 'demand',
    entityId: demand.id,
    files: fileResult.files,
    actor: { type: 'public', id: null },
  });
  if (mediaResult.error) {
    await supabase.from('demands').delete().eq('id', demand.id);
    return { error: mediaResult.error };
  }

  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  await telegramSendMessage(
    adminChatId,
    `🆕 <b>Nova demanda #${demand.id}</b>\n${title}\n\nHotel: ${areaName}\nSolicitante: ${requesterInfo}\nPrioridade: ${priority}`
  );

  return { success: true, id: demand.id, uploads: mediaResult.uploads };
}
