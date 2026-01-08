import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.89.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? '';
const SITE_URL_RAW = Deno.env.get('SITE_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? '';
const SITE_URL = normalizeSiteUrl(SITE_URL_RAW || 'https://devisfact.fr');
const ALLOWED_ORIGINS = new Set([SITE_URL]);

const buildCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, apikey',
});

const TOKEN_TTL_MS = 15 * 60 * 1000;
const TOKEN_BYTES = 32;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_WINDOW_MS = 30 * 60 * 1000;
const RESEND_LIMIT = 5;

const encoder = new TextEncoder();

async function hashCode(code: string) {
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashString = hashArray.map((byte) => String.fromCharCode(byte)).join('');
  return btoa(hashString);
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const cleaned = trimmed.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\+/g, '')}`;
  }
  return cleaned.replace(/\+/g, '');
}

function isSimpleSequence(value: string) {
  if (!value) {
    return true;
  }

  const uniqueDigits = new Set(value);
  if (uniqueDigits.size === 1) {
    return true;
  }

  const sequences = ['0123456789', '1234567890', '9876543210', '0987654321'];
  return sequences.includes(value);
}

function isValidFrenchPhone(value: string) {
  if (!value) {
    return false;
  }

  let digitsForCheck = '';
  if (value.startsWith('+')) {
    if (!value.startsWith('+33')) {
      return false;
    }
    const national = value.slice(3);
    if (!/^[1-9]\d{8}$/.test(national)) {
      return false;
    }
    digitsForCheck = `0${national}`;
  } else {
    if (!/^0[1-9]\d{8}$/.test(value)) {
      return false;
    }
    digitsForCheck = value;
  }

  return !isSimpleSequence(digitsForCheck);
}

serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(requestOrigin);

  if (requestOrigin && !ALLOWED_ORIGINS.has(requestOrigin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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
    const siteUrl = SITE_URL;
    if (!siteUrl) {
      throw new Error('Site URL not configured');
    }

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      throw new Error('Non authentifie');
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

    const payload = await req.json();
    const rawPhone = typeof payload?.phone === 'string'
      ? payload.phone
      : (typeof payload?.telephone === 'string' ? payload.telephone : '');
    const telephone = normalizePhoneInput(rawPhone);

    if (!isValidFrenchPhone(telephone)) {
      throw new Error('Numero de telephone invalide');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select(
        'telephone_verification_sent_at, telephone_verification_resend_count, telephone_verification_resend_window_start'
      )
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const now = new Date();
    const sentAt = profile?.telephone_verification_sent_at
      ? new Date(profile.telephone_verification_sent_at)
      : null;

    if (sentAt && now.getTime() - sentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new Error('Veuillez attendre avant de renvoyer un lien');
    }

    let resendCount = profile?.telephone_verification_resend_count ?? 0;
    let windowStart = profile?.telephone_verification_resend_window_start
      ? new Date(profile.telephone_verification_resend_window_start)
      : null;

    if (!windowStart || now.getTime() - windowStart.getTime() > RESEND_WINDOW_MS) {
      resendCount = 0;
      windowStart = now;
    }

    if (resendCount >= RESEND_LIMIT) {
      throw new Error('Trop de demandes de lien. Reessayez plus tard.');
    }

    resendCount += 1;

    const token = generateToken();
    const tokenHash = await hashCode(token);
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

    const { error: updateError } = await supabaseClient.rpc('request_phone_verification', {
      p_phone: telephone,
      p_code_hash: tokenHash,
      p_expires_at: expiresAt.toISOString(),
      p_sent_at: now.toISOString(),
      p_resend_count: resendCount,
      p_resend_window_start: windowStart.toISOString(),
    });

    if (updateError) throw updateError;

    const email = user.email;
    if (!email) {
      throw new Error('Email utilisateur introuvable');
    }

    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      throw new Error('Email provider not configured');
    }

    const confirmationUrl = `${siteUrl}/confirm-phone?token=${encodeURIComponent(token)}`;
    const emailText = [
      'Bonjour,',
      '',
      'Pour confirmer votre numero de telephone, cliquez sur ce lien :',
      confirmationUrl,
      '',
      'Ce lien expire dans 15 minutes.',
    ].join('\n');
    const emailHtml = `
      <p>Bonjour,</p>
      <p>Pour confirmer votre numero de telephone, cliquez sur ce bouton :</p>
      <p>
        <a
          href="${confirmationUrl}"
          style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;"
        >
          Confirmer mon numero
        </a>
      </p>
      <p>Si le bouton ne fonctionne pas, copiez ce lien :</p>
      <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      <p>Ce lien expire dans 15 minutes.</p>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: 'Validation du numero de telephone',
        text: emailText,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Email send failed: ${errorText}`);
    }

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
