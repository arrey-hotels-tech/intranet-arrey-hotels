import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createDownloadUrl, createUploadUrl, deleteObject, headObject } from '@/lib/r2';
import { logDatabaseError } from '@/lib/workspace';

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const TYPES = {
  'image/jpeg': { extension: 'jpg', max: 15 * 1024 * 1024 },
  'image/png': { extension: 'png', max: 15 * 1024 * 1024 },
  'image/webp': { extension: 'webp', max: 15 * 1024 * 1024 },
  'image/heic': { extension: 'heic', max: 15 * 1024 * 1024 },
  'application/pdf': { extension: 'pdf', max: 15 * 1024 * 1024 },
  'video/mp4': { extension: 'mp4', max: 100 * 1024 * 1024 },
  'video/quicktime': { extension: 'mov', max: 100 * 1024 * 1024 },
  'video/webm': { extension: 'webm', max: 100 * 1024 * 1024 },
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function parseAndValidateFiles(raw) {
  let files;
  try { files = JSON.parse(raw || '[]'); } catch { return { error: 'Lista de anexos inválida.' }; }
  if (!Array.isArray(files) || files.length > MAX_FILES) return { error: `Envie no máximo ${MAX_FILES} arquivos.` };
  let total = 0;
  for (const file of files) {
    const config = TYPES[file.type];
    if (!config || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > config.max) {
      return { error: `O arquivo “${String(file.name || 'sem nome').slice(0, 80)}” possui tipo ou tamanho não permitido.` };
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) return { error: 'Os anexos ultrapassam o limite total de 200 MB.' };
  return { files };
}

export async function prepareMediaUploads({ workspaceId, entityType, entityId, files, actor }) {
  if (!files.length) return { uploads: [] };
  const bucket = entityType === 'demand' ? process.env.R2_BUCKET_DEMANDS : process.env.R2_BUCKET_TASKS;
  const supabase = supabaseAdmin();
  const pending = files.map((file) => {
    const token = crypto.randomBytes(32).toString('base64url');
    const id = crypto.randomUUID();
    const objectKey = `workspaces/${workspaceId}/${entityType}s/${entityId}/${id}.${TYPES[file.type].extension}`;
    return { id, token, objectKey, file };
  });
  const { error } = await supabase.from('media_assets').insert(pending.map((item) => ({
    id: item.id,
    workspace_id: workspaceId,
    entity_type: entityType,
    entity_id: entityId,
    bucket,
    object_key: item.objectKey,
    original_name: String(item.file.name).slice(0, 255),
    mime_type: item.file.type,
    size_bytes: item.file.size,
    uploaded_by_type: actor.type,
    uploaded_by_id: actor.id || null,
    confirmation_token_hash: hashToken(item.token),
  })));
  if (error) {
    logDatabaseError('Falha ao preparar anexos', error);
    return { error: 'Não foi possível preparar os anexos.' };
  }
  const uploads = await Promise.all(pending.map(async (item) => ({
    id: item.id,
    token: item.token,
    url: await createUploadUrl(bucket, item.objectKey, item.file.type),
    contentType: item.file.type,
  })));
  return { uploads };
}

export async function confirmMediaUploads(items) {
  const supabase = supabaseAdmin();
  for (const item of items) {
    const { data: asset, error } = await supabase.from('media_assets').select('*').eq('id', item.id).eq('status', 'pending').maybeSingle();
    if (error || !asset || !crypto.timingSafeEqual(Buffer.from(asset.confirmation_token_hash), Buffer.from(hashToken(item.token)))) {
      return { error: 'Confirmação de anexo inválida.' };
    }
    const metadata = await headObject(asset.bucket, asset.object_key);
    if (metadata.ContentLength !== asset.size_bytes || metadata.ContentType !== asset.mime_type) {
      await deleteObject(asset.bucket, asset.object_key);
      return { error: `O anexo “${asset.original_name}” não corresponde ao arquivo autorizado.` };
    }
    const { error: updateError } = await supabase.from('media_assets').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', asset.id);
    if (updateError) return { error: 'Não foi possível confirmar o anexo.' };
  }
  return { success: true };
}

export async function listMediaForEntities(workspaceId, entityType, entityIds) {
  if (!entityIds.length) return new Map();
  const { data, error } = await supabaseAdmin().from('media_assets')
    .select('id, entity_id, original_name, mime_type, size_bytes, bucket, object_key')
    .eq('workspace_id', workspaceId).eq('entity_type', entityType).eq('status', 'ready').in('entity_id', entityIds);
  if (error) { logDatabaseError('Falha ao listar anexos', error); return new Map(); }
  const result = new Map();
  await Promise.all(data.map(async (asset) => {
    const entry = { id: asset.id, name: asset.original_name, mimeType: asset.mime_type, size: asset.size_bytes, url: await createDownloadUrl(asset.bucket, asset.object_key) };
    result.set(asset.entity_id, [...(result.get(asset.entity_id) || []), entry]);
  }));
  return result;
}

export async function deleteMediaForEntity(workspaceId, entityType, entityId) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('media_assets').select('id, bucket, object_key')
    .eq('workspace_id', workspaceId).eq('entity_type', entityType).eq('entity_id', entityId).neq('status', 'deleted');
  if (error) {
    logDatabaseError('Falha ao localizar anexos para exclusão', error);
    return { error: 'Não foi possível excluir os anexos.' };
  }
  await Promise.all((data || []).map((asset) => deleteObject(asset.bucket, asset.object_key).catch(() => null)));
  const { error: updateError } = await supabase.from('media_assets').update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('entity_type', entityType).eq('entity_id', entityId);
  if (updateError) logDatabaseError('Falha ao registrar exclusão de anexos', updateError);
  return { success: true };
}
