import 'server-only';
import webpush from 'web-push';

/**
 * Envío de notificaciones Web Push. Las claves VAPID identifican a la app ante
 * los servicios de push (Google, Mozilla, Apple): la pública la usa el
 * navegador para suscribirse; la privada firma cada envío y sólo vive en el
 * servidor.
 */
let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:avisos@cultivando.app';
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return configured;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Manda un aviso. `gone` es true si el servicio dice que la suscripción ya no
 * existe (el usuario la revocó o desinstaló): hay que borrarla.
 */
export async function sendPush(subscription: StoredSubscription, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  if (!pushConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: 'normal' }
    );
    return { ok: true, gone: false };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== 404 && status !== 410) console.error('Error enviando push:', status, (error as Error).message);
    return { ok: false, gone: status === 404 || status === 410 };
  }
}
