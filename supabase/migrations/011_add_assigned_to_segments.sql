-- Add assigned_to field to service_items for informational segment assignments
-- This allows specifying who is responsible for each segment (e.g., "Pastor Matt - Announcements")
-- No notifications are sent - this is purely informational for the schedule

ALTER TABLE service_items 
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Add comment for documentation
COMMENT ON COLUMN service_items.assigned_to IS 'Optional name of person assigned to this segment (informational only, no notifications)';
+++++++ REPLACE