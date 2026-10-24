import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Resets the caller's own MFA factors.
 *
 * Supabase refuses to enroll a new factor while the account still has a
 * verified one and the session is only `aal1` ("AAL2 required to enroll a new
 * factor"). That makes it impossible for a user who lost their authenticator
 * to scan a replacement QR code from the browser alone. This function uses the
 * service-role key to delete the caller's factors server-side, clears the
 * verification metadata, and (because deleting a verified factor signs the
 * user out) mints a one-time magic-link token so the browser can restore an
 * `aal1` session and immediately enroll a fresh authenticator.
 *
 * Only the caller's own factors are touched. Never expose the service-role key
 * to the browser.
 *
 * Deploy with: supabase functions deploy mfa-reset
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !projectUrl || !anonKey || !serviceKey) {
    return json({ error: 'Verification reset is not configured.' }, 503);
  }

  const userClient = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Authentication required.' }, 401);

  const admin = createClient(projectUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (listError) {
    return json({ error: `The authenticator list could not be read: ${listError.message}` }, 500);
  }

  let removed = 0;
  for (const factor of listed?.factors ?? []) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: factor.id,
    });
    if (deleteError) {
      return json({ error: `The authenticator could not be removed: ${deleteError.message}` }, 500);
    }
    removed += 1;
  }

  // Clear the flags the web panel reads so it returns to the setup card.
  const metadata = {
    ...(user.user_metadata ?? {}),
    verification_method: 'none',
    verification_destination: '',
    verification_verified_at: '',
    verification_enforced: false,
    verification_disabled: true,
  };
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: metadata,
  });
  if (updateError) {
    return json({ error: `Verification settings could not be cleared: ${updateError.message}` }, 500);
  }

  // Deleting a verified factor revokes the user's sessions, so hand the browser
  // a one-time token it can exchange for a fresh aal1 session. This keeps the
  // "scan the new QR code" flow going without asking for the password again.
  let tokenHash = '';
  if (removed > 0 && user.email) {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });
    if (!linkError) tokenHash = link?.properties?.hashed_token ?? '';
  }

  return json({ ok: true, removed, tokenHash }, 200);
});
