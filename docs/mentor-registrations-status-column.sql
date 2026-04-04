-- Add mentor approval workflow status field.
-- New registrations default to pending.

ALTER TABLE mentor_registrations
ADD COLUMN status ENUM('pending', 'active') DEFAULT 'pending';

-- Backfill any existing NULL values (safety).
UPDATE mentor_registrations
SET status = 'pending'
WHERE status IS NULL;
