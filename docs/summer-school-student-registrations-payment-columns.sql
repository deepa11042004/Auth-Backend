-- Adds payment tracking columns required for summer school student registration.
-- Table used by backend code: summer_school_student_registrations
-- If your deployed table is named summer_school_student_registration,
-- replace the table name accordingly before running.

ALTER TABLE summer_school_student_registrations
  ADD COLUMN payment_amount DECIMAL(10,2) NULL AFTER conduct_accepted,
  ADD COLUMN payment_currency VARCHAR(10) NULL AFTER payment_amount,
  ADD COLUMN razorpay_order_id VARCHAR(120) NULL AFTER payment_currency,
  ADD COLUMN razorpay_payment_id VARCHAR(120) NULL AFTER razorpay_order_id,
  ADD COLUMN payment_status VARCHAR(40) NULL AFTER razorpay_payment_id,
  ADD COLUMN payment_mode VARCHAR(40) NULL AFTER payment_status;

CREATE INDEX idx_summer_school_students_razorpay_order_id
  ON summer_school_student_registrations (razorpay_order_id);

CREATE INDEX idx_summer_school_students_razorpay_payment_id
  ON summer_school_student_registrations (razorpay_payment_id);
