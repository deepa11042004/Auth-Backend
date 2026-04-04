ALTER TABLE mentor_registrations
  MODIFY COLUMN status ENUM('pending', 'active', 'blocked') DEFAULT 'pending';
