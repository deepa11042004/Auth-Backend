ALTER TABLE summer_internship_registrations
  ADD COLUMN is_lateral BOOLEAN NOT NULL DEFAULT FALSE
  AFTER educational_qualification;
