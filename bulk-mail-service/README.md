# Bulk Mail Service Module

Reusable Node.js Express module for bulk email sending with AWS SES, BullMQ, Redis, and MySQL (raw SQL).

## Mount in Express

In your app setup:

app.use('/mail', require('./bulk-mail-service'));

## Environment Variables

Use the parent backend .env file:

AWS_ACCESS_KEY=
AWS_SECRET_KEY=
SES_REGION=
EMAIL_FROM=

DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_PORT=3306

# Optional but recommended when bulk-mail tables are in a separate schema
BULK_MAIL_DB_NAME=

# Optional source schema for recipient tables (defaults to DB_NAME)
BULK_MAIL_SOURCE_DB_NAME=

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

Optional queue tuning:

EMAIL_QUEUE_NAME=bulk-email-queue
EMAIL_QUEUE_ATTEMPTS=3
EMAIL_RATE_LIMIT_MAX=15
EMAIL_RATE_LIMIT_DURATION_MS=1000
EMAIL_FETCH_CHUNK_SIZE=500
EMAIL_WORKER_CONCURRENCY=5

# Set false only when you want strict Redis version checks; default behavior is true
BULLMQ_SKIP_REDIS_VERSION_CHECK=true

## API Endpoints

Base path: /mail

1) POST /single
Body:
{
  "email": "user@example.com",
  "subject": "Welcome",
  "body": "<p>Hello user</p>"
}

2) POST /bulk/raw
Body:
{
  "table_name": "students",
  "email_column": "email",
  "subject": "Announcement",
  "body": "<p>New update</p>"
}

3) POST /bulk/auto
Body:
{
  "table_name": "students",
  "email_column": "email",
  "first_name_column": "first_name",
  "last_name_column": "last_name",
  "subject": "Greetings"
}

4) POST /bulk/template
Body:
{
  "template_id": 1,
  "table_name": "students",
  "email_column": "email",
  "column_mapping": {
    "first_name": "first_name",
    "last_name": "last_name",
    "course": "course_name"
  }
}

Bonus endpoints:

- POST /templates/preview
- GET /status/:jobId
- GET /logs?status=sent|failed&email=user@example.com&limit=100
- POST /retry/:jobId

## Required Tables

Run SQL from db/schema.sql:

- templates
- email_logs

If your app database and bulk-mail database are different:

- Set BULK_MAIL_DB_NAME to the schema where templates and email_logs exist.
- Set BULK_MAIL_SOURCE_DB_NAME to the schema containing recipient tables.
- If omitted, DB_NAME is used as the fallback for both.

## Security Notes

- Dynamic table and column names are strictly validated.
- Information schema checks ensure table and columns exist.
- Values are parameterized with prepared statements.

## Queue Flow

API -> BullMQ Queue -> Worker -> AWS SES -> email_logs table

Each email is an individual job with retry support.
