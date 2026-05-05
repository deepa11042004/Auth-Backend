CREATE TABLE IF NOT EXISTS footer_news_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  link TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  position INT NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_footer_news_active_position (is_active, position),
  INDEX idx_footer_news_position (position)
);
