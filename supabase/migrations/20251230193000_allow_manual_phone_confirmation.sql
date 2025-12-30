-- Allow manual phone confirmation while keeping verification fields server-managed.
CREATE OR REPLACE FUNCTION public.protect_phone_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
      IF (NEW.telephone_verification_code IS DISTINCT FROM OLD.telephone_verification_code
          AND NEW.telephone_verification_code IS NOT NULL)
        OR (NEW.telephone_verification_expires_at IS DISTINCT FROM OLD.telephone_verification_expires_at
          AND NEW.telephone_verification_expires_at IS NOT NULL)
        OR (NEW.telephone_verification_sent_at IS DISTINCT FROM OLD.telephone_verification_sent_at
          AND NEW.telephone_verification_sent_at IS NOT NULL)
        OR (NEW.telephone_verification_attempts IS DISTINCT FROM OLD.telephone_verification_attempts
          AND COALESCE(NEW.telephone_verification_attempts, 0) <> 0)
        OR (NEW.telephone_verification_resend_count IS DISTINCT FROM OLD.telephone_verification_resend_count
          AND COALESCE(NEW.telephone_verification_resend_count, 0) <> 0)
        OR (NEW.telephone_verification_resend_window_start IS DISTINCT FROM OLD.telephone_verification_resend_window_start
          AND NEW.telephone_verification_resend_window_start IS NOT NULL)
      THEN
        RAISE EXCEPTION 'Telephone verification fields are managed server-side';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
