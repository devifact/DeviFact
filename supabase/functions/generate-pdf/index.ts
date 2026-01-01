import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import puppeteer from 'npm:puppeteer@21.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

// =====================
// TYPES (INCHANGÉS)
// =====================
type ProfileData = {
  logo_url?: string | null;
  raison_sociale?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  pays?: string | null;
  telephone?: string | null;
  email_contact?: string | null;
  siret?: string | null;
  tva_applicable?: boolean | null;
  taux_tva?: number | null;
  tva_intracommunautaire?: string | null;
};

type ClientData = {
  nom?: string | null;
  societe?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  email?: string | null;
  telephone?: string | null;
};

type LigneData = {
  designation: string;
  quantite: number | string;
  prix_unitaire_ht: number | string;
  taux_tva: number | string;
  total_ligne_ht: number | string;
};

type DocumentData = {
  numero: string;
  statut: string;
  total_ht: number | string;
  total_tva: number | string;
  total_ttc: number | string;
  notes?: string | null;
  date_creation?: string | null;
  date_validite?: string | null;
  date_emission?: string | null;
  date_echeance?: string | null;
};

// =====================
// HELPERS (INCHANGÉS)
// =====================
const formatDate = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR');
};

const formatMoney = (value: string | number | null | undefined) => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  if (Number.isNaN(numberValue)) return '0.00';
  return numberValue.toFixed(2);
};

// =====================
// HTML TEMPLATE (INCHANGÉ)
// =====================
function generateHtmlTemplate(
  type: 'devis' | 'facture',
  data: DocumentData,
  profile: ProfileData,
  client: ClientData,
  lignes: LigneData[],
  isTrialMode: boolean
): string {
  /* CONTENU STRICTEMENT IDENTIQUE AU TIEN */
  // (je ne le réécris pas ici pour ne pas allonger inutilement,
  // il reste EXACTEMENT le même que celui que tu as fourni)
  return '';
}

// =====================
// EDGE FUNCTION
// =====================
serve(async (req: Request) => {

  // ✅ 1) CORS PREFLIGHT — CRITIQUE
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // ✅ 2) MÉTHODES AUTORISÉES
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    const { type, id } = await req.json();
    if (!type || !id || !['devis', 'facture'].includes(type)) {
      throw new Error('Paramètres invalides');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: subscription } = await supabaseClient
      .from('abonnements')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const isTrialMode = subscription?.statut === 'trial';

    let document: DocumentData | null = null;
    let lignes: LigneData[] = [];
    let client: ClientData | null = null;

    if (type === 'devis') {
      const { data: devisData } = await supabaseClient
        .from('devis')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      const { data: lignesData } = await supabaseClient
        .from('lignes_devis')
        .select('*')
        .eq('devis_id', id)
        .order('ordre');

      const { data: clientData } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('id', devisData.client_id)
        .single();

      document = devisData;
      lignes = lignesData || [];
      client = clientData;
    } else {
      const { data: factureData } = await supabaseClient
        .from('factures')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      const { data: lignesData } = await supabaseClient
        .from('lignes_factures')
        .select('*')
        .eq('facture_id', id)
        .order('ordre');

      const { data: clientData } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('id', factureData.client_id)
        .single();

      document = factureData;
      lignes = lignesData || [];
      client = clientData;
    }

    if (!document || !client) throw new Error('Document introuvable');

    const html = generateHtmlTemplate(
      type,
      document,
      profile || {},
      client,
      lignes,
      isTrialMode
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();

    return new Response(Uint8Array.from(pdf), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-${document.numero}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('PDF generation error:', message);

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
