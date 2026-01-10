import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const SITE_URL = (Deno.env.get('SITE_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? 'https://devisfact.fr')
  .replace(/\/+$/, '');
const ALLOWED_ORIGINS = new Set([SITE_URL]);

const buildCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
});

const sanitizeFilenamePart = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '');

const DEFAULT_DOCUMENT_COLOR = '#2563eb';
const DOCUMENT_COLOR_OPTIONS = new Set([
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#fb7185',
]);

const resolveDocumentColor = (value?: string | null) =>
  value && DOCUMENT_COLOR_OPTIONS.has(value) ? value : DEFAULT_DOCUMENT_COLOR;

const hexToRgb = (hex: string) => {
  const normalized = hex.trim().replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  if (full.length !== 6) return null;
  const intValue = Number.parseInt(full, 16);
  if (Number.isNaN(intValue)) return null;
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
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
  code_ape?: string | null;
  tva_applicable?: boolean | null;
  taux_tva?: number | null;
  iban?: string | null;
  bic?: string | null;
};

type CompanySettingsData = {
  conditions_reglement?: string | null;
  delai_paiement?: string | null;
  penalites_retard?: string | null;
  indemnite_recouvrement_montant?: number | null;
  indemnite_recouvrement_texte?: string | null;
  escompte?: string | null;
  titulaire_compte?: string | null;
  banque_nom?: string | null;
  domiciliation?: string | null;
  modes_paiement_acceptes?: string | null;
  reference_paiement?: string | null;
  rib?: string | null;
  tva_intracommunautaire?: string | null;
  couleur_documents?: string | null;
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
  informations_travaux?: string | null;
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

const toNumber = (value: string | number | null | undefined) => {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const buildProfileLines = (profile: ProfileData) => {
  const lines: string[] = [];
  if (profile.raison_sociale) lines.push(profile.raison_sociale);
  if (profile.adresse) lines.push(profile.adresse);
  const cityParts: string[] = [];
  if (profile.code_postal) cityParts.push(profile.code_postal);
  if (profile.ville) cityParts.push(profile.ville);
  if (cityParts.length) lines.push(cityParts.join(' '));
  if (profile.pays) lines.push(profile.pays);
  if (profile.telephone) lines.push(`Tel: ${profile.telephone}`);
  if (profile.email_contact) lines.push(`Email: ${profile.email_contact}`);
  return lines;
};

const buildClientLines = (client: ClientData) => {
  const lines: string[] = [];
  if (client.nom) lines.push(client.nom);
  if (client.societe) lines.push(client.societe);
  if (client.adresse) lines.push(client.adresse);
  const cityParts: string[] = [];
  if (client.code_postal) cityParts.push(client.code_postal);
  if (client.ville) cityParts.push(client.ville);
  if (cityParts.length) lines.push(cityParts.join(' '));
  if (client.email) lines.push(`Email: ${client.email}`);
  if (client.telephone) lines.push(`Tel: ${client.telephone}`);
  return lines;
};

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  const clean = text.trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      current = testLine;
      continue;
    }

    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = '';
    for (const char of word) {
      const testChunk = chunk + char;
      if (font.widthOfTextAtSize(testChunk, size) <= maxWidth) {
        chunk = testChunk;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const drawRightAligned = (
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  xRight: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) => {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - textWidth, y, size, font, color });
};

const generatePdf = async (
  type: 'devis' | 'facture',
  document: DocumentData,
  profile: ProfileData,
  client: ClientData,
  lignes: LigneData[],
  isTrialMode: boolean,
  companySettings?: CompanySettingsData | null
) => {
  const pdfDoc = await PDFDocument.create();
  const width = 595.28;
  const height = 841.89;
  const margin = 40;
  const lineHeight = 14;
  const fontSize = 10;
  const titleSize = 18;

  let page = pdfDoc.addPage([width, height]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - margin;

  const accentHex = resolveDocumentColor(companySettings?.couleur_documents);
  const accentValues = hexToRgb(accentHex) ?? { r: 0.145, g: 0.388, b: 0.922 };
  const accentColor = rgb(accentValues.r, accentValues.g, accentValues.b);
  const accentTextColor = rgb(1, 1, 1);

  const drawTableHeader = () => {
    const colDesignationX = margin;
    const colQtyX = colDesignationX + 260;
    const colUnitX = colQtyX + 50;
    const colTvaX = colUnitX + 70;
    const colTotalX = colTvaX + 50;

    const headerHeight = lineHeight + 6;
    page.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: width - margin * 2,
      height: headerHeight,
      color: accentColor,
    });

    page.drawText('Designation', {
      x: colDesignationX,
      y,
      size: fontSize,
      font: fontBold,
      color: accentTextColor,
    });
    page.drawText('Qty', { x: colQtyX, y, size: fontSize, font: fontBold, color: accentTextColor });
    page.drawText('Unit HT', { x: colUnitX, y, size: fontSize, font: fontBold, color: accentTextColor });
    page.drawText('TVA', { x: colTvaX, y, size: fontSize, font: fontBold, color: accentTextColor });
    page.drawText('Total HT', {
      x: colTotalX,
      y,
      size: fontSize,
      font: fontBold,
      color: accentTextColor,
    });

    y -= lineHeight;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= lineHeight;
  };

  const ensureSpace = (needed: number, withTableHeader: boolean) => {
    if (y - needed >= margin) return;
    page = pdfDoc.addPage([width, height]);
    y = height - margin;
    if (withTableHeader) drawTableHeader();
  };

  const drawSection = (titleText: string, lines: string[]) => {
    if (!lines.length) return;
    const safeLines = lines.filter((line) => line && line.trim().length > 0);
    if (!safeLines.length) return;

    ensureSpace(lineHeight * (safeLines.length + 2), false);
    page.drawText(titleText, { x: margin, y, size: fontSize, font: fontBold, color: accentColor });
    y -= lineHeight;

    for (const line of safeLines) {
      const wrapped = wrapText(line, font, fontSize, width - margin * 2);
      for (const chunk of wrapped) {
        page.drawText(chunk, { x: margin, y, size: fontSize, font });
        y -= lineHeight;
      }
    }
  };

  const drawCompactSection = (titleText: string, content: string) => {
    if (!content || !content.trim()) return;
    const compactFontSize = 8;
    const compactLineHeight = 10;
    const wrapped = wrapText(content, font, compactFontSize, width - margin * 2);
    const needed = lineHeight + compactLineHeight * wrapped.length + compactLineHeight;
    ensureSpace(needed, false);

    page.drawText(titleText, { x: margin, y, size: fontSize, font: fontBold, color: accentColor });
    y -= lineHeight;

    for (const chunk of wrapped) {
      page.drawText(chunk, { x: margin, y, size: compactFontSize, font });
      y -= compactLineHeight;
    }
    y -= compactLineHeight;
  };

  const title = `${type.toUpperCase()} ${document.numero ?? ''}`.trim();
  page.drawText(title || type.toUpperCase(), {
    x: margin,
    y,
    size: titleSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= titleSize + 6;

  if (isTrialMode) {
    page.drawText('TRIAL MODE', {
      x: width - margin - 80,
      y: y + 6,
      size: 8,
      font: fontBold,
      color: rgb(0.7, 0, 0),
    });
  }

  const leftLines = buildProfileLines(profile);
  const rightLines = buildClientLines(client);
  const rightX = width / 2 + 10;
  const maxLines = Math.max(leftLines.length, rightLines.length, 1);

  for (let i = 0; i < maxLines; i += 1) {
    if (leftLines[i]) {
      page.drawText(leftLines[i], { x: margin, y, size: fontSize, font });
    }
    if (rightLines[i]) {
      page.drawText(rightLines[i], { x: rightX, y, size: fontSize, font });
    }
    y -= lineHeight;
  }

  y -= 4;

  const mentionDefaults = {
    conditions_reglement: 'Paiement a 30 jours',
    delai_paiement: 'Paiement a 30 jours',
    penalites_retard: 'Taux BCE + 10 points',
    indemnite_recouvrement_montant: 40,
    indemnite_recouvrement_texte: 'EUR (article L441-6 du Code de commerce)',
  };

  const mentionConditions = companySettings?.conditions_reglement ?? mentionDefaults.conditions_reglement;
  const mentionDelai = companySettings?.delai_paiement ?? mentionDefaults.delai_paiement;
  const mentionPenalites = companySettings?.penalites_retard ?? mentionDefaults.penalites_retard;
  const mentionIndemniteMontant = companySettings?.indemnite_recouvrement_montant ?? mentionDefaults.indemnite_recouvrement_montant;
  const mentionIndemniteTexte = companySettings?.indemnite_recouvrement_texte ?? mentionDefaults.indemnite_recouvrement_texte;
  const mentionEscompte = companySettings?.escompte ?? '';

  const defaultTvaRate = typeof companySettings?.taux_tva_defaut === 'number'
    ? companySettings.taux_tva_defaut
    : (typeof profile.taux_tva === 'number'
      ? profile.taux_tva
      : (profile.tva_applicable === false ? 0 : 20));
  const tvaNonApplicable = defaultTvaRate === 0;

  const mentionParts = [
    `Conditions: ${mentionConditions}`,
    `Delai: ${mentionDelai}`,
    `Penalites: ${mentionPenalites}`,
    `Indemnite: ${formatMoney(mentionIndemniteMontant)} ${mentionIndemniteTexte}`,
    mentionEscompte ? `Escompte: ${mentionEscompte}` : '',
    tvaNonApplicable ? 'TVA non applicable, art. 293B du CGI' : '',
  ].filter((part) => part && part.trim().length > 0);

  const bankParts = [
    companySettings?.titulaire_compte ? `Titulaire: ${companySettings.titulaire_compte}` : '',
    companySettings?.banque_nom ? `Banque: ${companySettings.banque_nom}` : '',
    companySettings?.domiciliation ? `Domiciliation: ${companySettings.domiciliation}` : '',
    profile.iban ? `IBAN: ${profile.iban}` : '',
    profile.bic ? `BIC: ${profile.bic}` : '',
    companySettings?.reference_paiement ? `Reference paiement: ${companySettings.reference_paiement}` : '',
    companySettings?.modes_paiement_acceptes ? `Modes de paiement: ${companySettings.modes_paiement_acceptes}` : '',
  ].filter((part) => part && part.trim().length > 0);

  const mentionSummary = mentionParts.join(' | ');
  const bankSummary = bankParts.join(' | ');
  const acceptanceText =
    'Bon pour accord. Le present devis vaut engagement apres acceptation par le client. ' +
    'Un acompte de 30 % du montant total TTC est demande a la signature du devis.';

  const metaLines: string[] = [];
  if (document.statut) metaLines.push(`Status: ${document.statut}`);
  if (document.date_creation) metaLines.push(`Date creation: ${formatDate(document.date_creation)}`);
  if (document.date_emission) metaLines.push(`Date emission: ${formatDate(document.date_emission)}`);
  if (document.date_validite) metaLines.push(`Validite: ${formatDate(document.date_validite)}`);
  if (document.date_echeance) metaLines.push(`Echeance: ${formatDate(document.date_echeance)}`);

  for (const line of metaLines) {
    page.drawText(line, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }

  if (type === 'devis' || type === 'facture') {
    y -= 6;
    const workInfo =
      document.informations_travaux && document.informations_travaux.trim()
        ? document.informations_travaux
        : 'Aucune information renseignee.';
    drawSection('Informations travaux / services', [workInfo]);
  }

  y -= 6;
  drawTableHeader();

  const colDesignationWidth = 260;
  const colQtyX = margin + colDesignationWidth;
  const colUnitX = colQtyX + 50;
  const colTvaX = colUnitX + 70;
  const colTotalX = colTvaX + 50;

  for (const ligne of lignes) {
    const designationLines = wrapText(
      String(ligne.designation ?? ''),
      font,
      fontSize,
      colDesignationWidth - 4
    );
    const rowHeight = designationLines.length * lineHeight;
    ensureSpace(rowHeight + lineHeight, true);

    let rowY = y;
    for (const [index, line] of designationLines.entries()) {
      page.drawText(line, { x: margin, y: rowY, size: fontSize, font });
      if (index === 0) {
        const qtyText = String(ligne.quantite ?? '');
        const unitText = formatMoney(ligne.prix_unitaire_ht);
        const tvaText =
          ligne.taux_tva === null || ligne.taux_tva === undefined
            ? ''
            : `${formatMoney(ligne.taux_tva)}%`;
        const totalText = formatMoney(ligne.total_ligne_ht);

        drawRightAligned(page, qtyText, colQtyX + 50 - 2, rowY, font, fontSize);
        drawRightAligned(page, unitText, colUnitX + 70 - 2, rowY, font, fontSize);
        drawRightAligned(page, tvaText, colTvaX + 50 - 2, rowY, font, fontSize);
        drawRightAligned(page, totalText, colTotalX + 70 - 2, rowY, font, fontSize);
      }
      rowY -= lineHeight;
    }
    y = rowY - 4;
  }

  if (type === 'devis') {
    y -= 4;
    drawSection('Acceptation du devis', [acceptanceText]);
  }

  const totalHtValue =
    document.total_ht === null || document.total_ht === undefined
      ? lignes.reduce((sum, line) => sum + toNumber(line.total_ligne_ht), 0)
      : toNumber(document.total_ht);
  const totalTvaValue =
    document.total_tva === null || document.total_tva === undefined
      ? lignes.reduce((sum, line) => {
          const ht = toNumber(line.total_ligne_ht);
          const taux = toNumber(line.taux_tva);
          return sum + ht * (taux / 100);
        }, 0)
      : toNumber(document.total_tva);
  const totalTtcValue =
    document.total_ttc === null || document.total_ttc === undefined
      ? totalHtValue + totalTvaValue
      : toNumber(document.total_ttc);

  ensureSpace(lineHeight * 4, false);
  const totalsLabelX = width - margin - 160;
  const totalsValueRight = width - margin;

  page.drawLine({
    start: { x: totalsLabelX, y },
    end: { x: totalsValueRight, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= lineHeight;

  page.drawText('Total HT', { x: totalsLabelX, y, size: fontSize, font, color: accentColor });
  drawRightAligned(page, formatMoney(totalHtValue), totalsValueRight, y, font, fontSize);
  y -= lineHeight;

  page.drawText('Total TVA', { x: totalsLabelX, y, size: fontSize, font, color: accentColor });
  drawRightAligned(page, formatMoney(totalTvaValue), totalsValueRight, y, font, fontSize);
  y -= lineHeight;

  const ttcRowHeight = lineHeight + 4;
  page.drawRectangle({
    x: totalsLabelX,
    y: y - 2,
    width: totalsValueRight - totalsLabelX,
    height: ttcRowHeight,
    color: accentColor,
  });
  page.drawText('Total TTC', { x: totalsLabelX, y, size: fontSize, font: fontBold, color: accentTextColor });
  drawRightAligned(
    page,
    formatMoney(totalTtcValue),
    totalsValueRight,
    y,
    fontBold,
    fontSize,
    accentTextColor
  );
  y -= lineHeight;

  if (document.notes) {
    ensureSpace(lineHeight * 3, false);
    page.drawText('Notes:', { x: margin, y, size: fontSize, font: fontBold });
    y -= lineHeight;
    const noteLines = wrapText(document.notes, font, fontSize, width - margin * 2);
    for (const line of noteLines) {
      page.drawText(line, { x: margin, y, size: fontSize, font });
      y -= lineHeight;
    }
  }

  if (type === 'facture') {
    drawCompactSection('Mentions obligatoires', mentionSummary);
    drawCompactSection(
      'Informations bancaires',
      bankSummary || 'Aucune information bancaire renseignee.'
    );
  } else {
    drawCompactSection(
      'Informations bancaires',
      bankSummary || 'Aucune information bancaire renseignee.'
    );
  }

  const footerAddressParts = [
    profile.adresse,
    [profile.code_postal, profile.ville].filter(Boolean).join(' ').trim(),
  ].filter(Boolean);
  const footerLines = [
    profile.raison_sociale ? `Raison sociale: ${profile.raison_sociale}` : '',
    footerAddressParts.length ? `Adresse siege: ${footerAddressParts.join(', ')}` : '',
    profile.telephone ? `Tel: ${profile.telephone}` : '',
    profile.email_contact ? `Email: ${profile.email_contact}` : '',
    profile.siret ? `SIRET: ${profile.siret}` : '',
    companySettings?.tva_intracommunautaire
      ? `TVA intracommunautaire: ${companySettings.tva_intracommunautaire}`
      : '',
    profile.code_ape ? `Code APE: ${profile.code_ape}` : '',
  ].filter((line) => line && line.trim().length > 0);

  if (footerLines.length) {
    const footerFontSize = 8;
    const footerLineHeight = 10;
    const footerChunks = footerLines.flatMap((line) =>
      wrapText(line, font, footerFontSize, width - margin * 2)
    );
    const footerHeight = footerLineHeight * footerChunks.length + footerLineHeight;
    if (y - footerHeight < margin) {
      page = pdfDoc.addPage([width, height]);
    }
    const footerStartY = margin + footerLineHeight * (footerChunks.length - 1);
    page.drawLine({
      start: { x: margin, y: footerStartY + footerLineHeight },
      end: { x: width - margin, y: footerStartY + footerLineHeight },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    let footerY = footerStartY;
    for (const line of footerChunks) {
      const textWidth = font.widthOfTextAtSize(line, footerFontSize);
      const x = Math.max(margin, (width - textWidth) / 2);
      page.drawText(line, { x, y: footerY, size: footerFontSize, font });
      footerY -= footerLineHeight;
    }
  }

  return await pdfDoc.save();
};

serve(async (req: Request) => {
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
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payload = await req.json();
    const type = payload?.type;
    const document = payload?.document as DocumentData | undefined;
    const client = payload?.client as ClientData | undefined;
    const profile = (payload?.profile ?? {}) as ProfileData;
    const lignes = Array.isArray(payload?.lignes) ? (payload.lignes as LigneData[]) : [];
    const isTrialMode = Boolean(payload?.isTrialMode);

    if (!type || !['devis', 'facture'].includes(type)) {
      throw new Error('Invalid type');
    }
    if (!document || !client) {
      throw new Error('Missing document or client');
    }

    const { data: settingsData, error: settingsError } = await supabaseClient
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const pdfBytes = await generatePdf(
      type,
      document,
      profile,
      client,
      lignes,
      isTrialMode,
      settingsData ?? null
    );
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    );
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    const numeroRaw = document.numero ? String(document.numero) : '';
    const safeNumero = sanitizeFilenamePart(numeroRaw) || 'document';

    return new Response(pdfBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-${safeNumero}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
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
