CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  workshop_id INT NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('registration_issue','payment_issue','workshop_info','reschedule_request','certificate_issue','other') NOT NULL DEFAULT 'other',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('open','in-progress','resolved','closed') NOT NULL DEFAULT 'open',
  attachment_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_support_tickets_user_id (user_id),
  INDEX idx_support_tickets_workshop_id (workshop_id),
  INDEX idx_support_tickets_status (status),
  INDEX idx_support_tickets_category (category),
  INDEX idx_support_tickets_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('user','admin') NOT NULL,
  message TEXT NOT NULL,
  attachment_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_messages_ticket_id (ticket_id),
  INDEX idx_ticket_messages_created_at (created_at)
);
