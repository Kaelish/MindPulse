import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders });
  }

  const authorization = request.headers.get('Authorization');
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !projectUrl || !anonKey || !serviceKey) {
    return Response.json({ error: 'Session control is not configured.' }, { status: 503, headers: corsHeaders });
  }

  const userClient = createClient(projectUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401, headers: corsHeaders });
  }

  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400, headers: corsHeaders });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return Response.json({ error: 'A valid session ID is required.' }, { status: 400, headers: corsHeaders });
  }

  const adminClient = createClient(projectUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: revoked, error: revokeError } = await adminClient.rpc('revoke_profile_auth_session', {
    p_user_id: user.id,
    p_session_id: sessionId,
  });
  if (revokeError) {
    return Response.json({ error: 'The session could not be revoked.' }, { status: 500, headers: corsHeaders });
  }
  if (!revoked) {
    return Response.json({ error: 'The session is already offline or expired.' }, { status: 404, headers: corsHeaders });
  }

  const channel = adminClient.channel(`profile-sessions:${user.id}`, { config: { private: true } });
  const broadcast = await channel.send({
    type: 'broadcast',
    event: 'session-revoked',
    payload: { sessionId },
  });
  await adminClient.removeChannel(channel);
  return Response.json({ ok: true, connected: broadcast === 'ok' }, { headers: corsHeaders });
});