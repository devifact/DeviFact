-- Add RPC helpers for phone verification without service role usage
CREATE OR REPLACE FUNCTION public.request_phone_verification(
  p_phone text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_sent_at timestamptz,
  p_resend_count integer,
  p_resend_window_start timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  PERFORM set_config('app.phone_verification', 'true', true);

  UPDATE profiles
  SET telephone = p_phone,
      telephone_verified = false,
      telephone_verification_code = p_code_hash,
      telephone_verification_expires_at = p_expires_at,
      telephone_verification_sent_at = p_sent_at,
      telephone_verification_attempts = 0,
      telephone_verification_resend_count = p_resend_count,
      telephone_verification_resend_window_start = p_resend_window_start
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_phone_verification(
  p_code_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_code text;
  v_expires timestamptz;
  v_attempts integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  SELECT
    telephone_verification_code,
    telephone_verification_expires_at,
    COALESCE(telephone_verification_attempts, 0)
  INTO v_code, v_expires, v_attempts
  FROM profiles
  WHERE id = v_user_id;

  IF v_code IS NULL OR v_expires IS NULL THEN
    RAISE EXCEPTION 'Aucun code en attente';
  END IF;

  IF v_expires < now() THEN
    PERFORM set_config('app.phone_verification', 'true', true);
    UPDATE profiles
    SET telephone_verification_code = null,
        telephone_verification_expires_at = null,
        telephone_verification_sent_at = null,
        telephone_verification_attempts = 0
    WHERE id = v_user_id;
    RAISE EXCEPTION 'Lien expire. Veuillez en demander un nouveau.';
  END IF;

  IF v_code <> p_code_hash THEN
    v_attempts := v_attempts + 1;
    PERFORM set_config('app.phone_verification', 'true', true);
    UPDATE profiles
    SET telephone_verification_attempts = v_attempts,
        telephone_verification_code = CASE WHEN v_attempts >= 5 THEN null ELSE telephone_verification_code END,
        telephone_verification_expires_at = CASE WHEN v_attempts >= 5 THEN null ELSE telephone_verification_expires_at END,
        telephone_verification_sent_at = CASE WHEN v_attempts >= 5 THEN null ELSE telephone_verification_sent_at END
    WHERE id = v_user_id;

    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Trop de tentatives. Veuillez renvoyer un lien.';
    END IF;

    RAISE EXCEPTION 'Lien invalide';
  END IF;

  PERFORM set_config('app.phone_verification', 'true', true);
  UPDATE profiles
  SET telephone_verified = true,
      telephone_verification_code = null,
      telephone_verification_expires_at = null,
      telephone_verification_sent_at = null,
      telephone_verification_attempts = 0,
      telephone_verification_resend_count = 0,
      telephone_verification_resend_window_start = null
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_phone_verification(
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_phone_verification(
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  timestamptz
) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_phone_verification(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_phone_verification(text) TO authenticated;

-- Allow RPC updates to bypass the trigger guard.
CREATE OR REPLACE FUNCTION public.protect_phone_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
    AND NOT (
      current_setting('app.phone_verification', true) = 'true'
      AND current_user <> session_user
    )
  THEN
    IF NEW.telephone IS DISTINCT FROM OLD.telephone THEN
      NEW.telephone_verified := false;
      NEW.telephone_verification_code := null;
      NEW.telephone_verification_expires_at := null;
      NEW.telephone_verification_sent_at := null;
      NEW.telephone_verification_attempts := 0;
      NEW.telephone_verification_resend_count := 0;
      NEW.telephone_verification_resend_window_start := null;
    ELSE
      IF NEW.telephone_verified IS DISTINCT FROM OLD.telephone_verified THEN
        RAISE EXCEPTION 'Telephone verification must be confirmed via email';
      END IF;

      IF NEW.telephone_verification_code IS DISTINCT FROM OLD.telephone_verification_code
        OR NEW.telephone_verification_expires_at IS DISTINCT FROM OLD.telephone_verification_expires_at
        OR NEW.telephone_verification_sent_at IS DISTINCT FROM OLD.telephone_verification_sent_at
        OR NEW.telephone_verification_attempts IS DISTINCT FROM OLD.telephone_verification_attempts
        OR NEW.telephone_verification_resend_count IS DISTINCT FROM OLD.telephone_verification_resend_count
        OR NEW.telephone_verification_resend_window_start IS DISTINCT FROM OLD.telephone_verification_resend_window_start
      THEN
        RAISE EXCEPTION 'Telephone verification fields are managed server-side';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
