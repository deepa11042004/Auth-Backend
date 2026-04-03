ALTER TABLE workshop_registrations
  ADD COLUMN payment_amount DECIMAL(10,2) NULL AFTER agree_terms,
  ADD COLUMN payment_currency VARCHAR(10) NULL AFTER payment_amount,
  ADD COLUMN razorpay_order_id VARCHAR(100) NULL AFTER payment_currency,
  ADD COLUMN razorpay_payment_id VARCHAR(100) NULL AFTER razorpay_order_id,
  ADD COLUMN payment_status VARCHAR(50) NULL AFTER razorpay_payment_id,
  ADD COLUMN payment_mode VARCHAR(50) NULL AFTER payment_status;

CREATE INDEX idx_workshop_registration_payment_order
  ON workshop_registrations (razorpay_order_id);

CREATE UNIQUE INDEX uq_workshop_registration_payment_id
  ON workshop_registrations (razorpay_payment_id);
