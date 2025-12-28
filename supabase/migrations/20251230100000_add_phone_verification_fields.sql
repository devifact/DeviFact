-- Add phone verification fields for profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telephone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS telephone_verification_code text,
  ADD COLUMN IF NOT EXISTS telephone_verification_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS telephone_verification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS telephone_verification_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telephone_verification_resend_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telephone_verification_resend_window_start timestamptz;

-- Protect verification fields from client-side updates
CREATE OR REPLACE FUNCTION protect_phone_verification_fields()
RETURNS trigger AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_phone_verification_fields ON profiles;
CREATE TRIGGER trigger_protect_phone_verification_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_phone_verification_fields();
