-- Allow null in work_area for jcb_operations
ALTER TABLE jcb_operations DROP CONSTRAINT IF EXISTS jcb_operations_work_area_check;
ALTER TABLE jcb_operations ADD CONSTRAINT jcb_operations_work_area_check CHECK (work_area IS NULL OR work_area IN ('quarry', 'crusher'));