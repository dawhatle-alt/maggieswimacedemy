-- Apply once to the Supabase/PostgreSQL project used by this business.
-- No data is imported from the former Sites D1 database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS maggie;
REVOKE ALL ON SCHEMA maggie FROM PUBLIC;
CREATE TABLE IF NOT EXISTS maggie.settings (id integer PRIMARY KEY, data text NOT NULL);
CREATE TABLE IF NOT EXISTS maggie.services (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
 duration integer NOT NULL CHECK(duration BETWEEN 10 AND 180),
 price integer NOT NULL CHECK(price>=0), active integer NOT NULL DEFAULT 1 CHECK(active IN(0,1))
);
CREATE TABLE IF NOT EXISTS maggie.slots (
 id text PRIMARY KEY, service_id text NOT NULL REFERENCES maggie.services(id),
 start timestamptz NOT NULL, "end" timestamptz NOT NULL, blocked_until timestamptz NOT NULL,
 location text NOT NULL CHECK(location IN('community','home','both')),
 active integer NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
 CHECK("end">start AND blocked_until>="end"),
 CONSTRAINT no_overlapping_active_slots EXCLUDE USING gist
 (tstzrange(start,blocked_until,'[)') WITH &&) WHERE(active=1)
);
CREATE INDEX IF NOT EXISTS idx_slots_start ON maggie.slots(start);
CREATE TABLE IF NOT EXISTS maggie.bookings (
 id text PRIMARY KEY, slot_id text NOT NULL REFERENCES maggie.slots(id),
 user_id text NOT NULL, email text NOT NULL, parent text NOT NULL, swimmer text NOT NULL,
 phone text NOT NULL, location text NOT NULL CHECK(location IN('community','home')),
 address text NOT NULL, notes text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','confirmed','completed','declined','cancelled')),
 service_name text NOT NULL, price integer NOT NULL CHECK(price>=0), duration integer NOT NULL,
 start timestamptz NOT NULL, "end" timestamptz NOT NULL, created timestamptz NOT NULL,
 invoice_id text, invoice_url text, invoice_status text, invoice_lock text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON maggie.bookings(slot_id)
 WHERE status IN('pending','confirmed','completed');
CREATE INDEX IF NOT EXISTS idx_bookings_user_start ON maggie.bookings(user_id,start);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON maggie.bookings(status);
-- Serialize slot withdrawal with booking insertion. The backend must not accept
-- a request based on an old snapshot of an already withdrawn slot.
CREATE OR REPLACE FUNCTION maggie.validate_booking_slot() RETURNS trigger LANGUAGE plpgsql
 SET search_path = maggie, pg_catalog AS $$
DECLARE available maggie.slots%ROWTYPE;
BEGIN
 SELECT * INTO available FROM maggie.slots WHERE id=NEW.slot_id FOR UPDATE;
 IF NOT FOUND OR available.active<>1 OR available.start<=now() THEN
  RAISE EXCEPTION 'Slot unavailable' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION maggie.validate_slot_withdrawal() RETURNS trigger LANGUAGE plpgsql
 SET search_path = maggie, pg_catalog AS $$
BEGIN
 IF NEW.active=0 AND OLD.active=1 AND EXISTS(
  SELECT 1 FROM maggie.bookings WHERE slot_id=NEW.id AND status IN('pending','confirmed','completed')
 ) THEN RAISE EXCEPTION 'Slot has an active booking' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_booking_slot ON maggie.bookings;
CREATE TRIGGER validate_booking_slot BEFORE INSERT ON maggie.bookings
 FOR EACH ROW EXECUTE FUNCTION maggie.validate_booking_slot();
DROP TRIGGER IF EXISTS validate_slot_withdrawal ON maggie.slots;
CREATE TRIGGER validate_slot_withdrawal BEFORE UPDATE ON maggie.slots
 FOR EACH ROW EXECUTE FUNCTION maggie.validate_slot_withdrawal();
ALTER TABLE maggie.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maggie.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE maggie.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE maggie.bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA maggie FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA maggie FROM PUBLIC;
-- On Supabase also explicitly deny browser API roles. DATABASE_URL uses the
-- server-only database owner connection; all family/admin authorization is in the API.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON SCHEMA maggie FROM anon;
  REVOKE ALL ON ALL TABLES IN SCHEMA maggie FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON SCHEMA maggie FROM authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA maggie FROM authenticated;
 END IF;
END $$;
COMMIT;

