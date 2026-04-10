-- Allow Kiosk (anon) to create approval requests and notifications
-- This is required for the Self-Service Attendance terminal to function

-- 1. Allow anon to create approval requests
DROP POLICY IF EXISTS "anon_insert_approvals" ON approval_workflows;
CREATE POLICY "anon_insert_approvals" ON approval_workflows 
FOR INSERT TO anon WITH CHECK (true);

-- 2. Allow anon to create notifications for the Director
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications 
FOR INSERT TO anon WITH CHECK (true);

-- 3. Ensure anon can see the status of their own requests for the Terminal to work
-- (Searching by record_id as we currently do)
DROP POLICY IF EXISTS "anon_select_approvals" ON approval_workflows;
CREATE POLICY "anon_select_approvals" ON approval_workflows 
FOR SELECT TO anon USING (true);
