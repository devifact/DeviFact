import "jsr:@supabase/functions-js@2.89.0/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? 'https://devisfact.fr')
  .replace(/\/+$/, '');
const ALLOWED_ORIGINS = new Set([SITE_URL]);

const buildCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
});

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(requestOrigin);

  if (requestOrigin && !ALLOWED_ORIGINS.has(requestOrigin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment is not configured');
    }

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Non authentifie');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Non authentifie');
    }

    const { devis_id } = await req.json();

    if (!devis_id) {
      throw new Error('devis_id requis');
    }

    const { data, error } = await supabaseClient
      .rpc('create_facture_from_devis', {
        p_devis_id: devis_id,
        p_user_id: user.id,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data: facture, error: factureError } = await supabaseClient
      .from('factures')
      .select(`
        *,
        client:clients(*),
        lignes:lignes_factures(*)
      `)
      .eq('id', data)
      .single();

    if (factureError) {
      throw new Error(factureError.message);
    }

    return new Response(
      JSON.stringify({ facture }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
