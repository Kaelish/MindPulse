import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Sends and verifies the six-digit codes used by the web portals' email, SMS
 * and WhatsApp sign-in verification.
 *
 * Required secrets (Supabase → Project Settings → Edge Functions):
 *   RESEND_API_KEY            – for email delivery
 *   VERIFICATION_EMAIL_FROM   – e.g. "MindPulse <security@yourdomain.com>"
 *   TWILIO_ACCOUNT_SID        – for SMS and WhatsApp delivery
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_SMS_FROM           – SMS sender, e.g. "+15551234567"
 *   TWILIO_MESSAGING_SERVICE_SID – alternative to TWILIO_SMS_FROM
 *   TWILIO_WHATSAPP_FROM      – e.g. "whatsapp:+14155238886"
 *   VERIFICATION_SECRET       – optional extra HMAC pepper
 *
 * Apply supabase/migrations/0027_verification_codes.sql before deploying.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const isValidPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);

const hashCode = async (userId: string, channel: string, destination: string, code: string, expiresAt: string) => {
  const secret = Deno.env.get('VERIFICATION_SECRET')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    ?? 'mindpulse-verification';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${userId}:${channel}:${destination}:${code}:${expiresAt}`),
  );
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const generateCode = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1000000).padStart(6, '0');
};

const sendEmail = async (destination: string, code: string) => {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('VERIFICATION_EMAIL_FROM');
  if (!apiKey || !from) {
    return 'Email delivery is not configured. Set RESEND_API_KEY and VERIFICATION_EMAIL_FROM for the verification-code function.';
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: `Your MindPulse verification code: ${code}`,
      text: `Your MindPulse sign-in verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password immediately.`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#0e7f96;margin:0 0 12px">MindPulse sign-in verification</h2>
        <p style="color:#334155">Use this code to finish signing in:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0f172a;margin:18px 0">${code}</p>
        <p style="color:#64748b;font-size:14px">The code expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password immediately.</p>
      </div>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return `The email provider rejected the message${detail ? `: ${detail.slice(0, 200)}` : '.'}`;
  }
  return null;
};

const sendWhatsApp = async (destination: string, code: string) => {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) {
    return 'WhatsApp delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM for the verification-code function.';
  }
  const body = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: `whatsapp:${destination}`,
    Body: `MindPulse verification code: ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password immediately.`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return `WhatsApp delivery failed${detail ? `: ${detail.slice(0, 200)}` : '.'}`;
  }
  return null;
};

const sendSms = async (destination: string, code: string) => {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_SMS_FROM');
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (!sid || !token || (!from && !messagingServiceSid)) {
    return 'SMS delivery is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID for the verification-code function.';
  }
  const body = new URLSearchParams({
    To: destination,
    Body: `MindPulse verification code: ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not try to sign in, change your password immediately.`,
  });
  // A Messaging Service handles sender pooling and compliance; a plain From
  // number is enough for a single Twilio sender.
  if (messagingServiceSid) body.set('MessagingServiceSid', messagingServiceSid);
  else if (from) body.set('From', from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return `SMS delivery failed${detail ? `: ${detail.slice(0, 200)}` : '.'}`;
  }
  return null;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !projectUrl || !anonKey || !serviceKey) {
    return json({ error: 'Verification is not configured on this project.' }, 503);
  }

  const userClient = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Authentication required.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const action = body.action === 'verify' ? 'verify' : body.action === 'send' ? 'send' : '';
  const channel = body.channel === 'email' || body.channel === 'whatsapp' || body.channel === 'sms' ? body.channel : '';
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  if (!action || !channel) return json({ error: 'Choose email, SMS or WhatsApp verification.' }, 400);
  if (channel === 'email' && !isValidEmail(destination)) return json({ error: 'Enter a valid email address.' }, 400);
  if ((channel === 'whatsapp' || channel === 'sms') && !isValidPhone(destination)) return json({ error: 'Enter a phone number in international format, for example +639170000000.' }, 400);

  const admin = createClient(projectUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === 'send') {
    const { data: recent } = await admin
      .from('verification_codes')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const ageSeconds = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
        return json({ error: `Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds)} seconds before requesting another code.` }, 429);
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
    const codeHash = await hashCode(user.id, channel, destination, code, expiresAt);

    // Expired codes are useless; keep the table small.
    await admin.from('verification_codes').delete().lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { error: insertError } = await admin.from('verification_codes').insert({
      user_id: user.id,
      channel,
      destination,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertError) {
      return json({ error: 'The verification code could not be stored. Apply the verification_codes migration first.' }, 500);
    }

    const deliveryError = channel === 'email'
      ? await sendEmail(destination, code)
      : channel === 'whatsapp'
        ? await sendWhatsApp(destination, code)
        : await sendSms(destination, code);
    if (deliveryError) {
      await admin.from('verification_codes').delete().eq('code_hash', codeHash);
      return json({ error: deliveryError }, 503);
    }

    return json({ ok: true, destination, expiresIn: CODE_TTL_MINUTES * 60 });
  }

  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (code.length !== 6) return json({ error: 'Enter the six-digit verification code.' }, 400);

  const { data: record, error: lookupError } = await admin
    .from('verification_codes')
    .select('id, code_hash, expires_at, attempts, consumed_at')
    .eq('user_id', user.id)
    .eq('channel', channel)
    .eq('destination', destination)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    return json({ error: 'The verification code could not be checked. Apply the verification_codes migration first.' }, 500);
  }
  if (!record) return json({ error: 'No active code was found. Request a new code.' }, 400);
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return json({ error: 'That code has expired. Request a new code.' }, 400);
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return json({ error: 'Too many incorrect attempts. Request a new code.' }, 429);
  }

  const expected = await hashCode(user.id, channel, destination, code, record.expires_at);
  if (expected !== record.code_hash) {
    await admin.from('verification_codes').update({ attempts: record.attempts + 1 }).eq('id', record.id);
    return json({ error: 'That code is not correct.' }, 400);
  }

  const { error: consumeError } = await admin
    .from('verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', record.id);
  if (consumeError) return json({ error: 'The verification code could not be completed.' }, 500);

  return json({ ok: true, destination });
});
