// ============================================================
// AION — Telegram Alert Service
// [HIGH-DEVOPS-003] Real-time alerting for 24/7 security ops
// ============================================================

type AlertLevel = 'info' | 'warning' | 'critical';

const EMOJI: Record<AlertLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

// Debounce map to avoid alert storms
const lastAlertTime = new Map<string, number>();
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes per unique alert

export async function sendAlert(level: AlertLevel, title: string, details: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!botToken || !chatId) return;

  // Debounce: don't send same alert within 5 minutes
  const key = `${level}:${title}`;
  const now = Date.now();
  const last = lastAlertTime.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  lastAlertTime.set(key, now);

  const message = `${EMOJI[level]} *AION Alert — ${level.toUpperCase()}*\n\n*${title}*\n${details}\n\n_${new Date().toISOString()}_`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
  }
}
