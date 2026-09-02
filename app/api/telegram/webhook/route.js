import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { telegramSendMessage } from '@/lib/telegram';

// A Vercel precisa estar em produção (URL pública) pra registrar esse webhook.
// Registro (rodar uma vez, depois do deploy):
// curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SEU-DOMINIO/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"

export async function POST(req) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = update?.message;
  const text = message?.text || '';

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const token = parts[1];
    const chatId = message?.chat?.id ? String(message.chat.id) : null;

    if (token && chatId) {
      const supabase = supabaseAdmin();
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('telegram_link_token', token)
        .gte('telegram_link_token_expires_at', new Date().toISOString())
        .maybeSingle();

      if (emp) {
        await supabase
          .from('employees')
          .update({
            telegram_chat_id: chatId,
            telegram_link_token: null,
            telegram_link_token_expires_at: null,
          })
          .eq('id', emp.id);

        await telegramSendMessage(chatId, '✅ Conta vinculada! Volte pro navegador e clique em "Já vinculei".');
      } else {
        await telegramSendMessage(chatId, '⚠️ Link inválido ou expirado. Peça um novo na tela de login.');
      }
    }
  }

  return NextResponse.json({ ok: true });
}
