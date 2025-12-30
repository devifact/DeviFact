import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const encoder = new TextEncoder();

async function hashCode(code: string) {
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashString = hashArray.map((byte) => String.fromCharCode(byte)).join('');
  return btoa(hashString);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment is not configured');
    }
    const payload = await req.json();
    const rawToken = typeof payload?.token === 'string' ? payload.token : '';
    const token = rawToken.trim();

    if (!token) {
      throw new Error('Token invalide');
    }

    const tokenHash = await hashCode(token);
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, telephone_verification_expires_at')
      .eq('telephone_verification_code', tokenHash)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      throw new Error('Lien invalide ou expire.');
    }

    const expiresAt = profile.telephone_verification_expires_at
      ? new Date(profile.telephone_verification_expires_at)
      : null;
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await adminClient
        .from('profiles')
        .update({
          telephone_verification_code: null,
          telephone_verification_expires_at: null,
          telephone_verification_sent_at: null,
          telephone_verification_attempts: 0,
          telephone_verification_resend_count: 0,
          telephone_verification_resend_window_start: null,
        })
        .eq('id', profile.id);

      throw new Error('Lien expire. Veuillez renvoyer la confirmation.');
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        telephone_verified: true,
        telephone_verification_code: null,
        telephone_verification_expires_at: null,
        telephone_verification_sent_at: null,
        telephone_verification_attempts: 0,
        telephone_verification_resend_count: 0,
        telephone_verification_resend_window_start: null,
      })
      .eq('id', profile.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
