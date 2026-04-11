-- Fix RLS constraints for ALL remaining contractor operation tables
-- This bypasses the faulty custom authentication mapping that erroneously crashes the system

-- Blasting Records
DROP POLICY IF EXISTS "Contractors can create blasting records" ON blasting_records;
DROP POLICY IF EXISTS "Managers can create blasting records" ON blasting_records;
DROP POLICY IF EXISTS "Allow authenticated users to insert blasting records" ON blasting_records;

CREATE POLICY "Allow authenticated users to insert blasting records"
  ON blasting_records FOR INSERT TO authenticated WITH CHECK (true);

-- Loading Records
DROP POLICY IF EXISTS "Contractors can create loading records" ON loading_records;
DROP POLICY IF EXISTS "Managers can create loading records" ON loading_records;
DROP POLICY IF EXISTS "Allow authenticated users to insert loading records" ON loading_records;

CREATE POLICY "Allow authenticated users to insert loading records"
  ON loading_records FOR INSERT TO authenticated WITH CHECK (true);

-- Transport Records
DROP POLICY IF EXISTS "Contractors can create transport records" ON transport_records;
DROP POLICY IF EXISTS "Managers can create transport records" ON transport_records;
DROP POLICY IF EXISTS "Allow authenticated users to insert transport records" ON transport_records;

CREATE POLICY "Allow authenticated users to insert transport records"
  ON transport_records FOR INSERT TO authenticated WITH CHECK (true);
