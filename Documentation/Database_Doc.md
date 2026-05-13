# Enterprise Database Architecture Documentation

## 1. Database Overview

This document serves as the comprehensive architectural and technical reference for the backend database system of the Peltown/Auth-backend project. 

### Purpose & Business Logic
The database is designed to handle a multi-faceted educational and institutional platform. It supports:
- **User Authentication & Authorization**: Role-based access control for users and administrators.
- **Registrations & Enrollments**: Processing of Summer Schools, Summer Internships, and Workshops.
- **Institutional Interactions**: Managing Institutional Registrations and MOU (Memorandum of Understanding) requests.
- **Mentorship Programs**: Application, pricing, and onboarding pipeline for mentors.
- **Support Systems**: A full-fledged ticketing system for resolving user queries.
- **Content Management**: Dynamic UI controls like Hero Slides, Footer News, and Dynamic Fee structures.
- **Payment Processing**: End-to-end Razorpay integration linking payment statuses directly to registration entities.

### Architecture & Technology Selection
- **Database Engine**: Relational SQL Database (MySQL).
- **Why MySQL**: Chosen for robust ACID compliance, structured schema definitions, referential capabilities, and efficient indexing for read-heavy operations like dashboard queries.
- **ORM / Query Builder**: The project uses **Raw SQL Queries** via the `mysql2/promise` driver rather than an ORM. This decision offers maximum control over query execution, optimization, and complex joins, at the expense of manual schema management.
- **Schema Management**: Schemas are enforced via programmatic "Ensure Table" scripts executed during service initialization or app startup (e.g., `CREATE TABLE IF NOT EXISTS...`). 

### Scalability, Reliability & Consistency
- **Connection Pooling**: Implemented via `mysql2` pool to manage connection limits and reuse database connections efficiently.
- **Transactions**: Multi-table insertions and updates (e.g., updating payment status and registering a user simultaneously) use strict SQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) to guarantee data integrity.
- **Concurrency**: Payment webhooks and retry mechanisms rely on transactional locking or conditional updates to prevent race conditions during concurrent Razorpay callbacks.

---

## 2. Database Technology Stack

- **Database Engine**: MySQL 8.x
- **Database Driver**: `mysql2` (Promise-based API)
- **Connection Handling**: Global connection pool (`db.js`) exported across all services.
- **Connection Pool Configuration**:
  - `waitForConnections`: true
  - `connectionLimit`: configurable via `DB_CONNECTION_LIMIT` (default: 10)
  - `queueLimit`: 0 (unlimited queueing of connection requests)
- **Environment Variables**:
  - `DB_HOST` / `BSERC_DB_HOST`
  - `DB_PORT` / `BSERC_DB_PORT`
  - `DB_USER` / `BSERC_DB_USER`
  - `DB_PASSWORD` / `BSERC_DB_PASSWORD`
  - `DB_NAME` / `BSERC_DB_NAME`
- **External Integrations**:
  - **Razorpay**: Tightly coupled with DB schemas; multiple tables have `razorpay_order_id` and `razorpay_payment_id` columns to track payment states.
  - **AWS S3**: Metadata and URLs for uploaded documents are stored in the DB while actual files are offloaded to S3 (or stored as `LONGBLOB` in specific legacy components).

---

## 3. Complete Database Schema Documentation

### 3.1 User Management

#### `users`
Purpose: Central repository for authentication, user profiles, and role management.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier. |
| `full_name` | VARCHAR(255) | NOT NULL | User's full name. |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | User email (used for login). |
| `password` | VARCHAR(255) | NOT NULL | Bcrypt hashed password. |
| `role` | VARCHAR(50) | NOT NULL DEFAULT 'user' | RBAC control ('user', 'admin'). |
| `is_active` | TINYINT(1) | DEFAULT 1 | Soft deletion / account suspension flag. |
| `last_login` | TIMESTAMP | NULL | Tracks user's last login time. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time. |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last modification time. |

*Engineering Note:* Users are often dynamically generated during successful workshop/internship payments.

---

### 3.2 Summer School Registrations

#### `summer_school_student_registrations`
Purpose: Stores student applications for the summer school program alongside their payment context.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique registration ID. |
| `full_name` | VARCHAR(255) | NOT NULL | Applicant name. |
| `dob` | DATE | NOT NULL | Date of birth. |
| `email` | VARCHAR(255) | NOT NULL | Applicant email. |
| `category` | VARCHAR(80) | NOT NULL | General Category or EWS. |
| `alternative_email` | VARCHAR(255) | NULL | Secondary contact. |
| `grade`, `school`, `board` | VARCHAR | NOT NULL | Academic details. |
| `nationality` | ENUM | 'Indian', 'Other' | Used for dynamic fee calculation. |
| `guardian_name`, `relationship`, `guardian_email`, `guardian_phone` | VARCHAR | NOT NULL | Guardian details. |
| `batch` | VARCHAR(255) | NOT NULL | Selected summer school batch. |
| `guidelines_accepted`, `conduct_accepted` | BOOLEAN | DEFAULT FALSE | Consent flags. |
| `payment_amount` | DECIMAL(10,2) | NULL | Amount paid. |
| `payment_currency` | VARCHAR(10) | NULL | Currency (INR, USD). |
| `razorpay_order_id` | VARCHAR(120) | NULL | Razorpay Order ID. |
| `razorpay_payment_id` | VARCHAR(120) | NULL | Razorpay Payment ID. |
| `payment_status` | VARCHAR(40) | NULL | pending, captured, failed. |
| `payment_mode` | VARCHAR(40) | NULL | Method of payment. |

**Indexes**: `idx_summer_school_students_created_at`, `idx_summer_school_students_email`, `idx_summer_school_students_razorpay_order_id`, `idx_summer_school_students_razorpay_payment_id`.

#### `summer_school_registration_settings`
Purpose: Global configuration for summer school dynamic fees and batch options. (Singleton table with `id=1`).

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | TINYINT | PRIMARY KEY | Always 1. |
| `indian_fee_amount` | DECIMAL(10,2)| DEFAULT 1350.00 | Base fee for Indians. |
| `ews_fee_amount` | DECIMAL(10,2) | DEFAULT 750.00 | Fee for EWS category. |
| `other_fee_amount` | DECIMAL(10,2) | DEFAULT 150.00 | Fee for international students. |
| `batch_options_json`| TEXT | NOT NULL | JSON array of available batches. |

---

### 3.3 Internship Registrations

#### `summer_internship_registrations`
Purpose: Applications and payment tracking for Summer Internships. Similar structure to summer school, but with specialized academic fields.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique ID. |
| `internship_name` | VARCHAR(255) | NOT NULL | Program name. |
| `is_lateral` | BOOLEAN | DEFAULT FALSE | Lateral entry flag. |
| `passport_photo_path`| VARCHAR(255) | NULL | Path/URL to passport photo. |
| *Payment Fields* | Mixed | NULL | Order ID, Payment ID, Amount, Status. |
*(Shared common fields omitted for brevity: full_name, email, dob, address, institution, etc.)*

#### `summer_internship_fee_settings`
Purpose: Dynamic fee control for internships (Singleton).

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | TINYINT | PRIMARY KEY | Always 1. |
| `general_fee_rupees` | DECIMAL(10,2)| DEFAULT 100.00 | Base fee. |
| `lateral_fee_rupees` | DECIMAL(10,2)| DEFAULT 100.00 | Lateral entry fee. |
| `ews_lateral_fee_rupees`| DECIMAL(10,2)| DEFAULT 1350.00 | Lateral EWS fee. |

---

### 3.4 Workshop Management

#### `workshop_list`
Purpose: Defines available workshops and their metadata.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Workshop ID. |
| `title` | VARCHAR(255) | NOT NULL | Workshop Name. |
| `description` | TEXT | NULL | Markdown/HTML description. |
| `workshop_date`, `start_time`, `end_time` | DATE / TIME| NULL | Scheduling information. |
| `fee` | DECIMAL(10,2) | NULL | Cost of workshop. |
| `thumbnail` | LONGBLOB | NULL | Direct DB image storage (Legacy). |
| `thumbnail_url` | VARCHAR(500) | NULL | S3/CDN URL. |
| `total_enrollments` | INT | DEFAULT 0 | Denormalized count of registered participants. |

#### `workshop_registrations`
Purpose: Participant registrations mapping to specific workshops.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique ID. |
| `workshop_id` | INT | NOT NULL | Foreign key logic referencing `workshop_list(id)`. |
| `full_name`, `email` | VARCHAR | NOT NULL | Participant details. |
| `designation` | ENUM | Student, Faculty, Professional, Others | Participant type. |
| `country` | VARCHAR(120) | NULL | Country of residence. |
| *Payment Fields* | Mixed | NULL | Tracks Razorpay details. |

---

### 3.5 Institutional & Mentorship

#### `institutional_registrations`
Purpose: Schools/Institutes requesting bulk processing or partnership.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique ID. |
| `institute_name` | VARCHAR(255) | NOT NULL | Name of school/institute. |
| `head_name`, `head_email`| VARCHAR | NOT NULL | Top authority contact. |
| `student_count` | VARCHAR(80) | NOT NULL | Expected volume. |
| `payment_status` | ENUM | 'success', 'failed', 'pending' | Status of bulk payment. |

#### `mou_requests`
Purpose: Tracking Memorandum of Understanding (MOU) partnerships.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY | Unique ID. |
| `institution_name` | VARCHAR(255) | NOT NULL | Name of institution. |
| `supporting_document_path`| VARCHAR(1024) | NULL | S3 object path for proposal PDF/DOC. |
| `supporting_document_mime`| VARCHAR(120) | NULL | Document type. |
| `supporting_document_storage`| ENUM('s3','hybrid') | NOT NULL | Active storage mode; runtime serves from S3. |

#### `mentor_registrations`
Purpose: Onboarding data for industry mentors.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY | Unique ID. |
| `professional_bio` | TEXT | NOT NULL | Mentor background. |
| `primary_track` | VARCHAR(255) | NOT NULL | Specialization track. |
| `honorarium_hourly` | DECIMAL(10,2) | NULL | Desired compensation. |
| `status` | VARCHAR(50) | DEFAULT 'pending' | Application status ('pending', 'active'). |
| `resume`, `profile_photo` | LONGBLOB | NULL | Binary data for documents. |

---

### 3.6 Support Ticketing System

#### `support_tickets`
Purpose: Master ticket records created by users.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Ticket ID. |
| `user_id` | INT | NOT NULL | FK to `users(id)`. |
| `workshop_id` | INT | NULL | FK to `workshop_list(id)` (optional). |
| `subject` | VARCHAR(200) | NOT NULL | Summary. |
| `category` | ENUM | (...) | Issue type (payment, registration, etc.). |
| `priority` | ENUM | 'low', 'medium', 'high' | Ticket priority. |
| `status` | ENUM | 'open', 'in-progress', 'resolved', 'closed' | Lifecycle status. |
| `attachment_url` | VARCHAR(500) | NULL | Optional screenshot/proof. |

#### `ticket_messages`
Purpose: Conversational thread for support tickets.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | INT | PRIMARY KEY | Message ID. |
| `ticket_id` | INT | NOT NULL | FK to `support_tickets(id)`. |
| `sender_id` | INT | NOT NULL | FK to `users(id)` (Admin or User). |
| `sender_role` | ENUM | 'user', 'admin' | Identifies context of reply. |
| `message` | TEXT | NOT NULL | Reply content. |

---

### 3.7 Content Management (CMS)

#### `hero_slides`
Purpose: Dynamic banners on the homepage. Stores actual image/video BLOBs directly in the database.

#### `footer_news_updates`
Purpose: Configurable ticker or news links in the footer.
Fields: `title`, `link`, `is_active`, `position`.

#### `contact_queries`
Purpose: General "Contact Us" form submissions.
Fields: `full_name`, `email`, `subject`, `message`, `is_solved`, `solved_at`.

---

## 4. Entity Relationship & Data Flow

While actual SQL `FOREIGN KEY` constraints are minimally enforced at the schema level (relying on application-layer logic), the logical relationships are:

1. **User → Tickets (One-to-Many)**: `users.id` maps to `support_tickets.user_id` and `ticket_messages.sender_id`.
2. **Workshop → Registrations (One-to-Many)**: `workshop_list.id` maps to `workshop_registrations.workshop_id`.
3. **Tickets → Messages (One-to-Many)**: `support_tickets.id` maps to `ticket_messages.ticket_id`.

**Referential Integrity Strategy**:
When a workshop is deleted, the `workshopListService` explicitly executes a transaction that runs `DELETE FROM workshop_registrations WHERE workshop_id = ?` before deleting the workshop itself, manually cascading the deletion.

---

## 5. Authentication & Authorization

- **User Model**: Standard custom implementation.
- **Password Strategy**: `bcrypt` used for hashing passwords before storage.
- **Tokens**: JWT (JSON Web Tokens) are generated and returned on login; however, tokens are stateless and *not* persisted in the database.
- **Roles**: Enforced at the application layer by checking the `users.role` field ('admin' vs 'user').

---

## 6. API to Database Architecture Flow

1. **Request Lifecycle**: 
   HTTP Request → Express Router → Controller → Service Layer → DB Connection Pool → Query Execution.
2. **Transactions**: Heavily utilized during registration flows. For instance, when registering an intern and logging a payment attempt:
   - `BEGIN`
   - Insert into `summer_internship_registrations`.
   - On Duplicate Key error (for retries), `UPDATE` existing row.
   - If payment is successful, execute `createUserIfMissing`.
   - `COMMIT` (or `ROLLBACK` on error).
3. **Retry Mechanisms**: `fetchPaymentFromRazorpayWithRetry` implements manual polling with delays (up to 6 attempts) to handle Razorpay webhook delays or eventual consistency issues.

---

## 7. Performance & Normalization

- **Normalization**: Generally falls into 2NF/3NF. 
- **Denormalization**: `total_enrollments` in `workshop_list` is manually incremented via `UPDATE` queries when a participant registers, preventing the need for expensive `COUNT(*)` queries on every page load.
- **Indexing Strategy**: Strategic indexes are added during table initialization:
  - Emails: `INDEX idx_..._email (email)`
  - Payment IDs: `INDEX idx_..._order_id (razorpay_order_id)`
  - Sorting: `INDEX idx_..._created_at (created_at)`

---

## 8. Data Storage Challenges & Decisions

### BLOB Storage vs Cloud Storage
- **Decision**: Several tables (`mou_requests`, `hero_slides`, `mentor_registrations`) store files directly as `LONGBLOB` in the database. 
- **Tradeoffs**: While this simplifies architecture by eliminating S3 dependencies for certain modules, it significantly bloats database size and impacts backup times. It is recommended to migrate these to S3 (similar to what `scripts/migrate-internship-passport-photos-to-s3.js` suggests is being actively worked on).

### Schema Versioning / Migrations
- **Decision**: No standard migration tool (like Prisma, Knex, or Flyway) is used. 
- **Implementation**: The system relies on `ensure...Table()` functions triggered by service calls. These functions use `CREATE TABLE IF NOT EXISTS` and manually use `SHOW COLUMNS` to detect if `ALTER TABLE` is required to inject new columns. 
- **Tradeoffs**: Highly resilient for local development but risky for production multi-instance deployments where race conditions might occur during `ALTER TABLE` executions.

---

## 9. Future Improvements

1. **Adopt a standard ORM/Migration tool**: Moving to Prisma or Sequelize would greatly stabilize schema changes and type safety.
2. **Remove BLOBs from DB**: Migrate all `LONGBLOB` columns (resumes, hero videos, certificates) to AWS S3, storing only the URLs in the database to optimize query performance and reduce memory usage.
3. **Database Constraints**: Enforce foreign keys at the MySQL level (e.g., `ON DELETE CASCADE`) to prevent orphaned records in tickets or registrations.
4. **Caching**: Introduce Redis to cache static CMS data like `hero_slides`, `footer_news_updates`, and dynamic fee settings to reduce load on MySQL.

---

## 10. Conclusion

The database architecture is robust, highly modular, and designed to handle complex edge cases surrounding payment synchronization via Razorpay. It employs strong SQL transaction handling and manual denormalization for performance. The primary areas for future architectural upgrades lie in standardizing database migrations and offloading binary media objects to dedicated object storage.
