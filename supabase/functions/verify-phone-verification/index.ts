import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment is not configured');
    }
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      throw new Error('Non authentifie');
    }
    const payload = await req.json();
    const rawToken = typeof payload?.token === 'string' ? payload.token : '';
    const token = rawToken.trim();

    if (!token) {
      throw new Error('Token invalide');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      throw new Error('Non authentifie');
    }

    const tokenHash = await hashCode(token);
    const { error: updateError } = await supabaseClient.rpc('confirm_phone_verification', {
      p_code_hash: tokenHash,
    });

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
