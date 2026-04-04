CREATE TABLE IF NOT EXISTS summer_internship_fee_settings (
  id TINYINT PRIMARY KEY,
  general_fee_rupees DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  lateral_fee_rupees DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO summer_internship_fee_settings (id, general_fee_rupees, lateral_fee_rupees)
VALUES (1, 100.00, 100.00)
ON DUPLICATE KEY UPDATE id = id;
