/*
  # Fix Permissive RLS Policies

  ## Overview
  This migration addresses security warnings identified by the Supabase linter:
  1. Restricts `workers` table INSERT policy to specific roles.
  2. Restricts `notifications` table INSERT policy to valid users.

  ## Changes

  ### 1. Update `workers` Policy
  - Drop overly permissive "Authenticated users can add workers" (WITH CHECK true)
  - Create new policy restricting INSERT to: 'manager', 'director', 'contractor', 'crusher_manager'

  ### 2. Update `notifications` Policy
  - Drop overly permissive "System can create notifications" (WITH CHECK true)
  - Create new policy requiring user existence in `users` table
*/

-- Update workers policy
DROP POLICY IF EXISTS "Authenticated users can add workers" ON workers;

CREATE POLICY "Authenticated users can add workers"
ON workers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
    AND users.role IN ('manager', 'director', 'contractor', 'crusher_manager')
  )
);

-- Update notifications policy
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())
  )
);
