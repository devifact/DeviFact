import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import puppeteer from 'npm:puppeteer@21.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

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
const formatDate = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR');
};

const formatMoney = (value: string | number | null | undefined) => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  if (Number.isNaN(numberValue)) return '0.00';
  return numberValue.toFixed(2);
};


function generateHtmlTemplate(
  type: 'devis' | 'facture',
  data: DocumentData,
  profile: ProfileData,
  client: ClientData,
  lignes: LigneData[],
  isTrialMode: boolean
): string {
  const isTrial = isTrialMode ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(255, 0, 0, 0.1); font-weight: bold; z-index: -1; pointer-events: none;">VERSION D\'ESSAI</div>' : '';
  const emissionDate = formatDate(type === 'devis' ? data.date_creation : data.date_emission);
  const validiteDate = type === 'devis' ? formatDate(data.date_validite) : '';
  const echeanceDate = type === 'facture' ? formatDate(data.date_echeance) : '';
  const defaultTvaRate = typeof profile.taux_tva === 'number'
    ? profile.taux_tva
    : (profile.tva_applicable === false ? 0 : 20);
  const tvaNonApplicable = defaultTvaRate === 0;
  const tvaHeader = tvaNonApplicable
    ? '<p><strong>TVA :</strong> TVA non applicable, art. 293B du CGI</p>'
    : `<p><strong>TVA par defaut :</strong> ${defaultTvaRate}%</p>${profile.tva_intracommunautaire ? `<p><strong>TVA Intracommunautaire :</strong> ${profile.tva_intracommunautaire}</p>` : ''}`;
  const tvaFooter = tvaNonApplicable
    ? ' - TVA non applicable, art. 293B du CGI'
    : (profile.tva_intracommunautaire ? ` - TVA Intracommunautaire : ${profile.tva_intracommunautaire}` : '');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${type === 'devis' ? 'Devis' : 'Facture'} ${data.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; padding: 40px; position: relative; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
    .logo { max-width: 150px; max-height: 80px; }
    .company-info { text-align: right; }
    .company-info h1 { color: #2563eb; font-size: 24pt; margin-bottom: 10px; }
    .company-info p { line-height: 1.6; }
    .document-info { margin: 30px 0; }
    .document-info h2 { color: #2563eb; font-size: 20pt; margin-bottom: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-box { width: 48%; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .info-box h3 { color: #2563eb; margin-bottom: 10px; font-size: 12pt; }
    .info-box p { line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    thead { background-color: #2563eb; color: white; }
    th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
    th { font-weight: bold; }
    tbody tr:nth-child(even) { background-color: #f9fafb; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; margin-top: 20px; }
    .totals table { margin: 0; }
    .totals .total-final { background-color: #2563eb; color: white; font-weight: bold; font-size: 14pt; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; line-height: 1.8; }
    .footer strong { color: #333; }
    .watermark { ${isTrial ? 'display: block;' : 'display: none;'} }
  </style>
</head>
<body>
  ${isTrial}
  
  <div class="header">
    <div>
      ${profile.logo_url ? `<img src="${profile.logo_url}" alt="Logo" class="logo">` : ''}
      <div style="margin-top: 10px;">
        <strong style="font-size: 14pt;">${profile.raison_sociale || ''}</strong>
        <p>${profile.adresse || ''}</p>
        <p>${profile.code_postal || ''} ${profile.ville || ''}</p>
        <p>${profile.pays || 'France'}</p>
      </div>
    </div>
    <div class="company-info">
      <h1>DevisFact</h1>
      <p><strong>Téléphone :</strong> ${profile.telephone || ''}</p>
      <p><strong>Email :</strong> ${profile.email_contact || ''}</p>
      <p><strong>SIRET :</strong> ${profile.siret || ''}</p>
      ${tvaHeader}
    </div>
  </div>

  <div class="document-info">
    <h2>${type === 'devis' ? 'DEVIS' : 'FACTURE'} N° ${data.numero}</h2>
  </div>

  <div class="info-row">
    <div class="info-box">
      <h3>Client</h3>
      <p><strong>${client.nom || ''}</strong></p>
      ${client.societe ? `<p>${client.societe}</p>` : ''}
      <p>${client.adresse || ''}</p>
      <p>${client.code_postal || ''} ${client.ville || ''}</p>
      <p><strong>Email :</strong> ${client.email || ''}</p>
      <p><strong>Téléphone :</strong> ${client.telephone || ''}</p>
    </div>
    <div class="info-box">
      <h3>Informations</h3>
      <p><strong>Date d'émission :</strong> ${emissionDate}</p>
      ${type === 'devis' ? `<p><strong>Date de validité :</strong> ${validiteDate}</p>` : ''}
      ${type === 'facture' ? `<p><strong>Date d'échéance :</strong> ${echeanceDate}</p>` : ''}
      <p><strong>Statut :</strong> ${data.statut}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Désignation</th>
        <th style="width: 10%;">Qté</th>
        <th style="width: 15%;">Prix unit. HT</th>
        <th style="width: 10%;">TVA</th>
        <th style="width: 15%;" class="text-right">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lignes.map(ligne => `
        <tr>
          <td>${ligne.designation}</td>
          <td>${ligne.quantite}</td>
          <td>${formatMoney(ligne.prix_unitaire_ht)} €</td>
          <td>${ligne.taux_tva}%</td>
          <td class="text-right">${formatMoney(ligne.total_ligne_ht)} €</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td><strong>Total HT</strong></td>
        <td class="text-right">${formatMoney(data.total_ht)} €</td>
      </tr>
      <tr>
        <td><strong>Total TVA</strong></td>
        <td class="text-right">${formatMoney(data.total_tva)} €</td>
      </tr>
      <tr class="total-final">
        <td><strong>Total TTC</strong></td>
        <td class="text-right"><strong>${formatMoney(data.total_ttc)} €</strong></td>
      </tr>
    </table>
  </div>

  ${data.notes ? `<div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #2563eb;"><strong>Notes :</strong><br>${data.notes}</div>` : ''}

  <div class="footer">
    <p><strong>Mentions légales :</strong></p>
    <p>${profile.raison_sociale || ''} - SIRET : ${profile.siret || ''}${tvaFooter}</p>
    <p>${profile.adresse || ''}, ${profile.code_postal || ''} ${profile.ville || ''}, ${profile.pays || 'France'}</p>
    ${type === 'facture' ? '<p><strong>Conditions de paiement :</strong> Paiement à 30 jours. En cas de retard de paiement, des pénalités égales à trois fois le taux d\'intérêt légal seront appliquées, ainsi qu\'une indemnité forfaitaire de 40€ pour frais de recouvrement.</p>' : ''}
    <p>${type === 'devis' ? '<strong>Validité du devis :</strong> Ce devis est valable jusqu\'au ' + validiteDate + '. Passé ce délai, il devra être renouvelé.' : ''}</p>
  </div>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
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

    if (!user) {
      throw new Error('Non authentifié');
    }

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

    if (!document || !client) {
      throw new Error('Document introuvable');
    }

    const profileData: ProfileData = profile || {};
    const html = generateHtmlTemplate(type, document, profileData, client, lignes, isTrialMode);

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

    const pdfData = Uint8Array.from(pdf as ArrayLike<number>);

    return new Response(pdfData, {
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
