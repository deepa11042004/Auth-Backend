-- Adds a cached enrollment counter to workshop_list.
-- Existing workshops intentionally remain at 0.
-- Counter starts from new successful enrollments after this migration.

ALTER TABLE workshop_list
  ADD COLUMN total_enrollments INT UNSIGNED NOT NULL DEFAULT 0 AFTER fee;
