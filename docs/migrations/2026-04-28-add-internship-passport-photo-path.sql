ALTER TABLE summer_internship_registrations
  ADD COLUMN passport_photo_path VARCHAR(1024) NULL AFTER passport_photo,
  ADD INDEX idx_internship_passport_photo_path (passport_photo_path(191));
