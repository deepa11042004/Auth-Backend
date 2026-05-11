-- Advisory Board Applications table
-- Status workflow:
--   pending -> active (approved by admin)
--   pending/active -> deleted (rejected/removed by admin)

CREATE TABLE IF NOT EXISTS advisory_board_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  designation VARCHAR(200) NOT NULL,
  organization_institution VARCHAR(255) NOT NULL,
  department_specialisation VARCHAR(255) NULL,
  official_email VARCHAR(255) NOT NULL,
  alternative_email VARCHAR(255) NULL,
  mobile_number VARCHAR(50) NOT NULL,
  location_text VARCHAR(255) NULL,
  highest_qualification VARCHAR(255) NULL,
  qualification_year VARCHAR(20) NULL,
  experience_years INT NULL,
  key_research_areas TEXT NULL,
  professional_expertise TEXT NULL,
  preferred_contributions_json LONGTEXT NULL,
  preferred_contribution_other VARCHAR(255) NULL,
  contribution_modes_json LONGTEXT NULL,
  contribution_mode_other VARCHAR(255) NULL,
  monthly_hours INT NULL,
  interaction_modes_json LONGTEXT NULL,
  availability_period VARCHAR(255) NULL,
  suggestions_json LONGTEXT NULL,
  viksit_bharat_contribution TEXT NULL,
  media_support TINYINT(1) NULL,
  media_tools TEXT NULL,
  declaration_accepted TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('pending', 'active') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_advisory_status (status),
  INDEX idx_advisory_created_at (created_at),
  INDEX idx_advisory_official_email (official_email)
);
