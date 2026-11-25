export async function enviarTelegram(mensagem: string): Promise<void> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/\r/g, '')
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID?.trim().replace(/\r/g, '')

  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: CHAT_ID, text: mensagem, parse_mode: 'HTML' }),
    })
  } catch {
    // não bloqueia o fluxo de agendamento
  }
}
