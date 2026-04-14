-- Separate profile table for dynamic user profile fields
-- Compatible with current user dashboard profile flow.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT NOT NULL,
  phone VARCHAR(20) NULL,
  city VARCHAR(120) NULL,
  institution VARCHAR(180) NULL,
  bio TEXT NULL,
  profile_picture_url VARCHAR(500) NULL,
  notification_email TINYINT(1) NOT NULL DEFAULT 1,
  notification_workshop_updates TINYINT(1) NOT NULL DEFAULT 1,
  notification_marketing TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_user_profiles_updated_at (updated_at),
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Remove legacy column if it exists from an older schema.
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS interests;

-- Backfill one profile row per existing user.
-- INSERT IGNORE avoids duplicate errors for users that already have a profile row.
INSERT IGNORE INTO user_profiles (user_id)
SELECT id
FROM users;
