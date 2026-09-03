'use server';

import { confirmMediaUploads } from '@/lib/media';

export async function confirmUploads(items) {
  if (!Array.isArray(items) || items.length > 5) return { error: 'Confirmação de anexos inválida.' };
  try {
    return await confirmMediaUploads(items.map((item) => ({ id: String(item.id), token: String(item.token) })));
  } catch (error) {
    console.error('[R2] Falha ao confirmar anexos:', { name: error?.name, message: error?.message });
    return { error: 'Não foi possível confirmar os anexos.' };
  }
}
