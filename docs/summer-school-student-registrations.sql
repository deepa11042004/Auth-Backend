CREATE TABLE IF NOT EXISTS summer_school_student_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,

    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    email VARCHAR(255) NOT NULL,
    grade VARCHAR(80) NOT NULL,
    school VARCHAR(255) NOT NULL,
    board VARCHAR(120) NOT NULL,
    nationality ENUM('Indian', 'Other') NOT NULL,
    gender VARCHAR(40) NULL,

    guardian_name VARCHAR(255) NOT NULL,
    relationship VARCHAR(80) NOT NULL,
    guardian_email VARCHAR(255) NOT NULL,
    guardian_phone VARCHAR(30) NOT NULL,
    alt_phone VARCHAR(30) NULL,

    batch VARCHAR(255) NOT NULL,
    experience TEXT NULL,

    guidelines_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    conduct_accepted BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_summer_school_students_created_at (created_at),
    INDEX idx_summer_school_students_email (email)
);

ALTER TABLE summer_school_student_registrations
    ADD COLUMN IF NOT EXISTS nationality ENUM('Indian', 'Other') NOT NULL DEFAULT 'Indian' AFTER board;