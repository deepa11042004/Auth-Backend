# Backend Business Logic & Feature Architecture

This document provides a comprehensive, implementation-aware technical breakdown of the backend architecture, focusing on feature-by-feature workflows, business logic, retry mechanisms, database interactions, and integrations. It is generated through an exhaustive analysis of the Node.js/Express backend codebase.

---

## Table of Contents
1. [Global Architecture & Request Pipeline](#1-global-architecture--request-pipeline)
2. [Authentication & Role Management](#2-authentication--role-management)
3. [Payment & Reconciliation Engine](#3-payment--reconciliation-engine)
4. [Workshop Management & Registration](#4-workshop-management--registration)
5. [Mentor Registration System](#5-mentor-registration-system)
6. [Internship & Summer School Systems](#6-internship--summer-school-systems)
7. [Institutional Registration System](#7-institutional-registration-system)
8. [Support Ticket System](#8-support-ticket-system)
9. [User Dashboard & Progress Tracking](#9-user-dashboard--progress-tracking)
10. [File Upload & Storage Architecture](#10-file-upload--storage-architecture)
11. [Notification System](#11-notification-system)

---

## 1. Global Architecture & Request Pipeline

### Overview
The backend is structured as a monolithic Express.js application following a standard MVC-inspired architecture: `Routes -> Controllers -> Services -> Database/Integrations`. 

### Request Pipeline (`app.js`)
1. **CORS & Body Parsing**: Standard JSON body parsing is applied globally, with raw body caching (`req.rawBody`) enabled for potential webhook signature verifications.
2. **Static Uploads**: Serves local files from the `/uploads` directory natively via Express static mapping.
3. **API Routing**: Routes are modularized by feature domain (e.g., `/auth`, `/api/user-dashboard`, `/api/mentor-registration`).
4. **Global Error Handling**: A centralized `errorHandler.js` catches unhandled exceptions, preventing server crashes and ensuring consistent JSON error responses.

### Common Engineering Decisions
- **Service Layer Isolation**: All complex business logic, database queries, and external API calls are decoupled from Controllers and placed in Services. Controllers strictly handle HTTP request validation and response formatting.
- **Fail-Safe Fallbacks**: Many queries have structural fallbacks for smooth schema migrations (e.g., catching `ER_BAD_FIELD_ERROR` to maintain backward compatibility during live deployments).

---

## 2. Authentication & Role Management

### Feature Overview
Handles user onboarding, authentication, session issuance via JWT, and profile management.

### Architecture Components
- **Routes**: `authRoutes.js`
- **Controller**: `authController.js`
- **Service**: `authService.js`
- **Security Middleware**: `authMiddleware.js`, `roleMiddleware.js`, `requireRole.js`
- **Utilities**: `hashPassword.js`, `jwt.js`
- **Database Table**: `users`

### Request Lifecycle Flow
1. **Registration**: Validates email/password, checks for existing users, hashes the password using bcrypt (`hashPassword.js`), and inserts a new row into `users` with a default `USER` role.
2. **Login**: Verifies credentials, checks `is_active` status (rejects disabled accounts), updates `last_login`, and issues a signed JWT containing `userId`, `email`, and `role`.
3. **Authorization**: Routes are protected by `authMiddleware` (validates JWT) and `requireRole` / `roleMiddleware` (enforces RBAC, e.g., Admin vs User).

### Important Functions
- `login(payload)`: Handles active account checks and token issuance. Includes an automatic `updateLastLogin` query for auditing.
- `changePassword(userId, oldPassword, newPassword)`: Validates old password hash before updating to a new hash.

---

## 3. Payment & Reconciliation Engine

### Feature Overview
The backend heavily integrates with Razorpay for handling paid registrations across multiple modules (Workshops, Mentors, Internships, Institutions). Because webhook delivery is notoriously unreliable, the backend implements an advanced **Proactive Payment Reconciliation & Retry Engine**.

### Architecture Components
- **Core Integrations**: `razorpayService.js`
- **Domain Services**: `workshopRegistrationService.js`, `mentorRegistrationService.js`, `internshipRegistrationService.js`, `institutionalRegistrationService.js`

### Request / Workflow Flow (Payment & Reconciliation)
When a user attempts to register/pay, the system does not just blindly create a new order. It performs the following robust lifecycle:
1. **Pending Attempt Discovery**: Queries the respective table (e.g., `mentor_registrations`) for the user's latest `pending` or `failed` attempt.
2. **Reconciliation (The Core Engine)**:
   - If an open `razorpay_order_id` exists, the system actively queries Razorpay (`razorpayClient.orders.fetchPayments`) to see if the user actually paid successfully but the backend missed the webhook.
   - It utilizes an exponential backoff / retry mechanism (`fetchPaymentFromRazorpayWithRetry` with 6 attempts, 1.2s delay) to overcome temporary Razorpay API timeouts or replication lags.
   - If a successful payment is found (`captured` or `authorized`), the backend *retroactively upgrades* the local database record to `success`, fulfilling the registration without charging the user again.
3. **Order Creation**: If no successful payment exists, a new Razorpay Order is created.
4. **Verification**: Frontend sends back `razorpay_signature`. The backend validates it cryptographically (`isValidRazorpaySignature`).
5. **Fulfillment**: Database is updated with the final `payment_status`, `payment_amount`, and transaction IDs.

### Engineering Decisions & Failure Handling
- **Duplicate Prevention**: The proactive reconciliation flow strictly prevents a user from paying twice if they refresh the page or if a webhook drops.
- **Resilient Polling**: `resolvePaymentFromOrderContext` handles Razorpay eventual consistency by repeatedly polling the API.
- **Graceful Degradation**: If Razorpay credentials are missing, the system catches the error gracefully, returning a 500 status with an explicit log message.

---

## 4. Workshop Management & Registration

### Feature Overview
Admins create/manage workshops, and users register for them. Registrations can be paid or free.

### Architecture Components
- **Services**: `workshopListService.js`, `workshopRegistrationService.js`
- **Tables**: `workshop_list`, `workshop_registrations`

### Important Logic & Database Interactions
- **Dynamic Schema Checks**: `workshopListService.js` gracefully handles missing columns like `total_enrollments` by catching `ER_BAD_FIELD_ERROR` and falling back to a hardcoded `0`, allowing the app to run before migrations are completed.
- **Registration Flow**: 
  - Resolves fee in paise. 
  - If the fee is 0, skips payment creation.
  - Automatically provisions a new user account (`createWorkshopUserIfMissing`) using their contact number as a default hashed password if they do not exist in the system.
- **Transaction Updates**: Uses atomic `COALESCE(total_enrollments, 0) + 1` to increment the enrollment counter upon successful payment.

---

## 5. Mentor Registration System

### Feature Overview
Professionals apply to become mentors. Includes dynamic fee structures based on nationality.

### Workflow & Business Logic
- **Nationality-Based Pricing**: Resolves fees dynamically (`Indian` = 1000 INR, `Others` = 150 USD).
- **Extensive Schema**: Manages over 40 distinct attributes (bio, track, availability, consultation fees, URLs).
- **Upsert Logic (`upsertMentorRegistration`)**: Uses database transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) to safely update an existing pending application or create a new one. It maps dynamic frontend payloads to safe SQL updates dynamically (`getMentorWritableColumns`).
- **Payment Safety**: If a mentor application already exists and is `completed`, the system prevents arbitrary payload updates.

---

## 6. Internship & Summer School Systems

### Feature Overview
Handles student applications for Internships and Summer Schools, which feature complex categorized pricing tiers and batch options.

### Architecture Components
- **Services**: `internshipRegistrationService.js`, `summerSchoolService.js`
- **Tables**: `summer_internship_registrations`, `summer_internship_fee_settings`, `summer_school_registration_settings`

### Important Logic & Edge Cases
- **Dynamic Configuration Tables**: Instead of hardcoding prices, fees are stored in DB tables (e.g., `summer_internship_fee_settings`). If the table is missing, the service *automatically creates it* (`ensureInternshipFeeSettingsSchema`) on the fly.
- **Complex Fee Resolution**: 
  - Internships: Differentiates between General vs. Lateral vs. Lateral EWS (Economically Weaker Section).
  - Summer School: Matrix pricing based on Nationality (Indian/Other) AND Category (General/EWS).
- **Failed Attempt Reuse**: If an applicant previously attempted to pay but failed, the `registerInternshipInternal` method intercepts the `ER_DUP_ENTRY` error and *re-uses* the existing row, updating it with the new payment attempt ID rather than throwing an error to the user.

---

## 7. Institutional Registration System

### Feature Overview
Allows schools/institutions to register for partnerships.

### Workflow & Business Logic
- **Country-based Pricing**: `India` = 2500 INR, International = 500 USD.
- **Reconciliation Engine**: Employs the same Razorpay retry/polling engine to prevent duplicate institutional charges.
- **Upgrade Flow**: Maps payment attempt statuses (`pending`, `failed`, `success`). If a webhook arrives or reconciliation succeeds, it upgrades the `payment_status` and records the `transaction_id`.

---

## 8. Support Ticket System

### Feature Overview
A full Help Desk system where users can raise tickets, attach files, and communicate with admins.

### Architecture Components
- **Service**: `ticketService.js`
- **Tables**: `support_tickets` (metadata), `ticket_messages` (chat history)
- **Integrations**: `notificationService.js`

### Request Lifecycle Flow
1. **Ticket Creation**: Inserts metadata into `support_tickets` and the first message into `ticket_messages`.
2. **Notification Trigger**: Asynchronously calls `notificationService.sendTicketCreatedEmail` to email the user and admins.
3. **Admin Reply**: Admin adds a message. The ticket status automatically shifts from `open` to `in-progress`. Email notification sent to user.
4. **Resolution**: Admin closes the ticket.

### Database Interactions
- Heavy use of SQL `LEFT JOIN` to fetch the workshop context (`workshop_title`) and user metadata (`user_name`) dynamically in a single query.
- Employs subqueries to fetch the `last_message` efficiently on the ticket listing page.

---

## 9. User Dashboard & Progress Tracking

### Feature Overview
Aggregates a user's enrolled workshops, wishlist, profile settings, and certificates.

### Business Logic
- **Progress Inference (`clampProgress`)**: If actual progress is not tracked via active modules, it conditionally infers a 20% progress simply if the user has a successful payment.
- **Certificate Issuance**: Dynamically generates a certificate response object if `certificate_available` is true and `progress_percent >= 80%` or status is `completed`.
- **Wishlist Management**: Simple UPSERT (`ON DUPLICATE KEY UPDATE`) strategy for saving workshops to a wishlist.
- **Fallback Query Chains**: `fetchUserWorkshopRows` attempts 4 different SQL query permutations (toggling Payment columns and Alternative Email inclusion) to elegantly handle database schemas that might be partially migrated in different environments.

---

## 10. File Upload & Storage Architecture

### Feature Overview
Handles diverse file uploads (resumes, passport photos, MOU documents, ticket attachments).

### Architecture Components
- **Services**: `s3StorageService.js`, local Express `multer` middlewares (`heroSlideUpload.js`, etc.)
- **AWS Integration**: `@aws-sdk/client-s3`

### Workflows
1. **Local Uploads**: General assets (hero slides, workshop thumbnails) are uploaded locally to `/uploads` via `multer`.
2. **AWS S3 Direct Uploads**: Sensitive/large files (e.g., Internship Passport Photos) utilize `s3StorageService.js`.
   - **Path Generation**: `buildInternshipPassportPhotoKey` dynamically generates structured S3 keys containing the year, internship slug, email slug, and a randomized crypto-hash to prevent collisions.
   - **Presigned URLs**: Utilizes `getSignedUrl` to dynamically grant temporary access to S3 objects, improving security.

---

## 11. Notification System

### Feature Overview
Centralized email dispatcher for system alerts.

### Architecture Components
- **Service**: `notificationService.js`
- **Integration**: `nodemailer`

### Business Logic
- Utilizes an initialized, cached `transporter` singleton for performance.
- Supports multiple async mailing tasks executing concurrently (`Promise.allSettled(mailTasks)`).
- Wraps nodemailer calls in `try/catch` to ensure that if an email fails to send (e.g., SMTP timeout), it *does not break* the main application workflow (e.g., a ticket is still created successfully even if the email fails).
