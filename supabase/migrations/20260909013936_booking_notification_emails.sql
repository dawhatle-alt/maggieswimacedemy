BEGIN;
CREATE TABLE IF NOT EXISTS maggie.booking_emails (
 id text PRIMARY KEY,
 booking_id text NOT NULL REFERENCES maggie.bookings(id),
 kind text NOT NULL CHECK(kind IN ('submitted','confirmed')),
 booking jsonb NOT NULL,
 payload text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','skipped','review')),
 created timestamptz NOT NULL DEFAULT now(),
 first_attempt_at timestamptz,
 locked_until timestamptz,
 sent_at timestamptz,
 provider_id text,
 error_code text,
 UNIQUE(booking_id,kind)
);
CREATE INDEX IF NOT EXISTS idx_booking_emails_pending ON maggie.booking_emails(created) WHERE state='pending';
ALTER TABLE maggie.booking_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON maggie.booking_emails FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON maggie.booking_emails FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON maggie.booking_emails FROM authenticated; END IF;
END $$;
-- Queue the event in the same transaction as the booking change. Existing bookings
-- are deliberately not backfilled: deployment must not send historical emails.
CREATE OR REPLACE FUNCTION maggie.queue_booking_email() RETURNS trigger LANGUAGE plpgsql
 SET search_path=maggie,pg_catalog AS $$
DECLARE event_kind text;
BEGIN
 IF TG_OP='INSERT' AND NEW.status='pending' THEN event_kind:='submitted';
 ELSIF TG_OP='UPDATE' THEN
  IF OLD.status='pending' AND NEW.status='confirmed' THEN event_kind:='confirmed'; END IF;
 END IF;
 IF event_kind IS NOT NULL THEN
  INSERT INTO maggie.booking_emails(id,booking_id,kind,booking)
  VALUES(NEW.id||':'||event_kind,NEW.id,event_kind,jsonb_build_object(
   'email',NEW.email,'parent',NEW.parent,'swimmer',NEW.swimmer,
   'service_name',NEW.service_name,'price',NEW.price,'duration',NEW.duration,
   'start',NEW.start,'location',NEW.location,'address',NEW.address))
  ON CONFLICT(booking_id,kind) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION maggie.queue_booking_email() FROM PUBLIC;
DROP TRIGGER IF EXISTS queue_booking_email ON maggie.bookings;
CREATE TRIGGER queue_booking_email AFTER INSERT OR UPDATE OF status ON maggie.bookings
 FOR EACH ROW EXECUTE FUNCTION maggie.queue_booking_email();
COMMIT;
