import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const OTP_MAX_ATTEMPTS = 5;

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment is not configured');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Non authentifie');
    }

    const payload = await req.json();
    const rawCode = typeof payload?.code === 'string' ? payload.code : '';
    const code = rawCode.replace(/\s+/g, '').trim();

    if (!code || code.length < 4) {
      throw new Error('Code invalide');
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(
        'telephone_verification_code, telephone_verification_expires_at, telephone_verification_attempts'
      )
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.telephone_verification_code || !profile?.telephone_verification_expires_at) {
      throw new Error('Aucun code en attente');
    }

    const expiresAt = new Date(profile.telephone_verification_expires_at);
    if (expiresAt.getTime() < Date.now()) {
      await adminClient
        .from('profiles')
        .update({
          telephone_verification_code: null,
          telephone_verification_expires_at: null,
          telephone_verification_attempts: 0,
          telephone_verification_sent_at: null,
        })
        .eq('id', user.id);

      throw new Error('Code expire. Veuillez en demander un nouveau.');
    }

    const codeHash = await hashCode(code);
    if (codeHash !== profile.telephone_verification_code) {
      const attempts = (profile.telephone_verification_attempts ?? 0) + 1;

      const updates: Record<string, unknown> = {
        telephone_verification_attempts: attempts,
      };

      if (attempts >= OTP_MAX_ATTEMPTS) {
        updates.telephone_verification_code = null;
        updates.telephone_verification_expires_at = null;
        updates.telephone_verification_sent_at = null;
      }

      await adminClient.from('profiles').update(updates).eq('id', user.id);

      throw new Error(
        attempts >= OTP_MAX_ATTEMPTS
          ? 'Trop de tentatives. Veuillez renvoyer un code.'
          : 'Code invalide'
      );
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
      .eq('id', user.id);

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
