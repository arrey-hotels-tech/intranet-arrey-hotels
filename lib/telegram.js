const TELEGRAM_API = 'https://api.telegram.org';

export async function telegramSendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return await res.json();
  } catch (err) {
    console.error('Falha ao enviar mensagem no Telegram:', err);
    return null;
  }
}

export function telegramDeepLink(token) {
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  return `https://t.me/${bot}?start=${token}`;
}
