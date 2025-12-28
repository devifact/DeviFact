import "jsr:@supabase/functions-js@2.89.0/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non authentifié');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Non authentifié');
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
