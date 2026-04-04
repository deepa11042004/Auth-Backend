CREATE TABLE summer_internship_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,

    internship_name VARCHAR(255) NOT NULL DEFAULT 'Def-Space Summer Internship',
    internship_designation VARCHAR(255) NOT NULL DEFAULT 'Def-Space Tech Intern',

    full_name VARCHAR(255) NOT NULL,
    guardian_name VARCHAR(255) NOT NULL,
    gender VARCHAR(50) NOT NULL,
    dob DATE NOT NULL,

    mobile_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    alternative_email VARCHAR(255) NULL,

    address TEXT NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    pin_code VARCHAR(20) NOT NULL,

    institution_name VARCHAR(255) NOT NULL,
    educational_qualification VARCHAR(120) NOT NULL,
    is_lateral BOOLEAN NOT NULL DEFAULT FALSE,

    declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,

    passport_photo LONGBLOB NOT NULL,
    passport_photo_mime_type VARCHAR(100) NULL,
    passport_photo_file_name VARCHAR(255) NULL,

    payment_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    razorpay_order_id VARCHAR(100) NULL,
    razorpay_payment_id VARCHAR(100) NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_summer_internship_email (email),
    UNIQUE KEY uq_summer_internship_payment (razorpay_payment_id),
    INDEX idx_summer_internship_created_at (created_at)
);
