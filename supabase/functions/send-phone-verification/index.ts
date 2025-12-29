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
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? '';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
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

function generateCode() {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return randomValue.toString().padStart(OTP_LENGTH, '0');
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
    const rawPhone = typeof payload?.telephone === 'string' ? payload.telephone : '';
    const telephone = normalizePhoneInput(rawPhone);

    if (!isValidFrenchPhone(telephone)) {
      throw new Error('Numero de telephone invalide');
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await adminClient
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
      throw new Error('Veuillez attendre avant de renvoyer un code');
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
      throw new Error('Trop de demandes de code. Reessayez plus tard.');
    }

    resendCount += 1;

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        telephone,
        telephone_verified: false,
        telephone_verification_code: codeHash,
        telephone_verification_expires_at: expiresAt.toISOString(),
        telephone_verification_sent_at: now.toISOString(),
        telephone_verification_attempts: 0,
        telephone_verification_resend_count: resendCount,
        telephone_verification_resend_window_start: windowStart.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    const email = user.email;
    if (!email) {
      throw new Error('Email utilisateur introuvable');
    }

    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      throw new Error('Email provider not configured');
    }

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
        text: `Votre code de validation du numero de telephone : ${code}`,
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
