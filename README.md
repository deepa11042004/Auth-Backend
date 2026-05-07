# BSERC Auth Backend API

Node.js + Express backend providing JWT authentication, role-based access control, payment processing (Razorpay), file storage (AWS S3), and domain-specific registration APIs for BSERC platform.

## 1. What This Backend Provides

- **Authentication** — register, login, change password, profile, role-protected routes
- **User Dashboard** — profile, workshops, certificates, wishlist, progress, attendance, downloads, settings
- **Workshop Management** — workshop list CRUD, enrollment with Razorpay payment flow
- **Internship Registration** — application with passport photo upload to S3, Razorpay payment flow, admin review
- **Mentor Registration** — registration with resume + profile photo (S3), payment flow, admin approve/reject
- **Summer School Registration** — student registration with Razorpay payment flow, settings management
- **Institutional Registration** — institutional form submission with Razorpay payment flow
- **MoU Requests** — MoU proposal form with supporting document upload
- **Hero Slides** — admin-managed hero banner slides with media upload to S3
- **Footer News** — admin-managed footer news/update items
- **Contact Queries** — public contact form, admin management with solve/pending status
- **Help Desk Tickets** — user ticket creation with attachments, admin reply and status management
- **General Registrations** — Razorpay-backed registrations with webhook and payment sync
- **Swagger UI** — interactive API docs at `/api-docs`
- **Role-based authorization** — `user`, `admin`, `instructor`, `super_admin` roles

## 2. Tech Stack

- Node.js + Express
- mysql2/promise
- jsonwebtoken + bcrypt
- Razorpay (payment orders, verification, webhooks)
- AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) — S3 file storage
- multer — multipart file uploads
- sharp — image processing
- swagger-jsdoc + swagger-ui-express

## 3. Database Architecture

A single MySQL pool (`bsercDB`) is used against `bserc_core_db`.

### 3.1 Tables Used (bserc_core_db)

- `users`
- `workshop_list`
- `workshop_registrations`
- `internship_registrations`
- `mentor_registrations`
- `summer_school_student_registrations`
- `institutional_registrations`
- `mou_requests`
- `hero_slides`
- `footer_news_updates`
- `contact_queries`
- `tickets` / `ticket_messages`
- `registrations` (general, auto-created on startup)

## 4. Environment Variables

Create a `.env` file in the project root.

### 4.1 Core Variables

```
PORT=5000
JWT_SECRET=your_jwt_secret

# Primary DB fallback
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=bserc_core_db
DB_CONNECTION_LIMIT=10

# bserc-specific credentials (preferred over DB_* above)
BSERC_DB_HOST=127.0.0.1
BSERC_DB_PORT=3306
BSERC_DB_USER=root
BSERC_DB_PASSWORD=your_bserc_db_password
BSERC_DB_NAME=bserc_core_db
```

### 4.2 AWS S3

```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=your_bucket_name
```

### 4.3 Razorpay

```
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4.4 DB Credential Fallback Order

`BSERC_DB_*` → `DB_*` → built-in defaults

## 5. Install and Run

```bash
npm install
npm start
```

Server default: `http://localhost:5000`

### One-off Scripts

```bash
# Migrate existing internship passport photos from DB blobs to S3
npm run migrate:internship-photos
```

## 6. API Endpoints

### 6.1 System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/api-docs` | Swagger UI |
| GET | `/api-docs.json` | OpenAPI spec (JSON) |

### 6.2 Authentication (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login, returns JWT |
| POST | `/auth/change-password` | JWT | Change own password |
| GET | `/auth/profile` | JWT | Get own profile |
| GET | `/auth/admin-only` | JWT + admin/super_admin | Admin test route |
| GET | `/auth/instructor-only` | JWT + instructor/super_admin | Instructor test route |

### 6.3 User Dashboard (`/api/user-dashboard`)

All routes require a valid user JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Get profile |
| PUT | `/profile` | Update profile |
| POST | `/change-password` | Change password |
| GET | `/workshops` | Enrolled workshops |
| GET | `/certificates` | Certificates |
| GET | `/wishlist` | Wishlist items |
| POST | `/wishlist` | Add to wishlist |
| DELETE | `/wishlist/:workshopId` | Remove from wishlist |
| GET | `/progress` | Learning progress |
| GET | `/attendance` | Attendance records |
| GET | `/downloads` | Downloadable resources |
| GET | `/settings` | User settings |
| PUT | `/settings` | Update settings |

### 6.4 Workshops (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/workshop-list` | — | List all workshops |
| GET | `/workshop-list/list` | — | Alias for workshop list |
| GET | `/workshop-list/participants` | — | All workshop participants |
| POST | `/workshop-list/create` | — | Create workshop |
| PUT | `/workshop-list/:id` | — | Update workshop |
| DELETE | `/workshop-list/:id` | — | Delete workshop |
| POST | `/workshop/enrollment` | — | Enroll (free workshop) |
| POST | `/workshop/enrollment/create-order` | — | Create Razorpay order |
| POST | `/workshop/enrollment/verify-payment` | — | Verify payment and enroll |

### 6.5 Internships (`/api`) 

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/internship/registration/create-order` | — | Create Razorpay order |
| POST | `/internship/registration/verify-payment` | — | Verify payment and register (with passport photo) |
| POST | `/internship/registration/register` | — | Register without payment (zero-fee) |
| GET | `/internship/registration/list` | Admin | List all applications |
| GET | `/internship/registration/:id/passport-photo-url` | Admin | Get S3 presigned photo URL |

### 6.6 Mentors (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/mentor/register` | — | Register mentor (with resume + photo) |
| POST | `/mentor/create-order` | — | Create Razorpay order |
| POST | `/mentor/log-payment-attempt` | — | Log payment attempt |
| GET | `/mentor/requests` | — | List pending mentor applications |
| GET | `/mentor/list` | — | List active mentors |
| PATCH | `/mentor/:id/approve` | — | Approve mentor |
| PATCH | `/mentor/:id/pending` | — | Move mentor back to pending |
| DELETE | `/mentor/:id/reject` | — | Reject mentor |
| GET | `/mentor/:id` | — | Get mentor by ID |
| GET | `/mentor/:id/resume` | — | Stream mentor resume from S3 |
| GET | `/mentor/:id/profile-photo` | — | Stream mentor profile photo from S3 |

### 6.7 Summer School (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/summer-school/student-registration/create-order` | Create Razorpay order |
| POST | `/summer-school/student-registration/verify-payment` | Verify payment and register |
| POST | `/summer-school/student-registration/log-payment-attempt` | Log payment attempt |
| POST | `/summer-school/student-registration` | Register (free) |
| GET | `/summer-school/student-registration` | List registrations |
| DELETE | `/summer-school/student-registration/:id` | Delete registration |
| GET | `/summer-school/student-registration/settings` | Get registration settings |
| PUT | `/summer-school/student-registration/settings` | Update registration settings |

### 6.8 Institutional Registration (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/institutional-registration/create-order` | Create Razorpay order |
| POST | `/institutional-registration/verify-payment` | Verify payment and register |
| POST | `/institutional-registration/log-payment-attempt` | Log payment attempt |
| POST | `/institutional-registration` | Register (free) |
| GET | `/institutional-registration` | List registrations |
| DELETE | `/institutional-registration/:id` | Delete registration |

### 6.9 MoU Requests (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mou-requests` | Submit MoU proposal (with document upload) |
| GET | `/mou-requests` | List all MoU requests |
| GET | `/mou-requests/:id/document` | Download supporting document |
| DELETE | `/mou-requests/:id` | Delete MoU request |

### 6.10 Hero Slides (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin/hero-slides` | Admin | Create hero slide |
| GET | `/admin/hero-slides` | Admin | List slides (admin) |
| PUT | `/admin/hero-slides/:id` | Admin | Update slide |
| DELETE | `/admin/hero-slides/:id` | Admin | Delete slide |
| GET | `/hero-slides` | — | List active slides (public) |
| GET | `/hero-slides/:id/media` | — | Stream slide media |

### 6.11 Footer News (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin/footer-news` | Admin | Create news item |
| GET | `/admin/footer-news` | Admin | List items (admin) |
| PUT | `/admin/footer-news/:id` | Admin | Update item |
| DELETE | `/admin/footer-news/:id` | Admin | Delete item |
| GET | `/footer-news` | — | List active items (public) |

### 6.12 Contact Queries (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/contact-queries` | Submit contact form |
| GET | `/contact-queries` | List all queries |
| DELETE | `/contact-queries/:id` | Delete query |
| PUT | `/contact-queries/:id/solve` | Mark as solved |
| PUT | `/contact-queries/:id/pending` | Mark as pending |

### 6.13 Help Desk Tickets (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tickets` | User | Create ticket (with attachment) |
| GET | `/tickets/my` | User | Get own tickets |
| GET | `/tickets/:id` | User | Get ticket detail |
| POST | `/tickets/:id/message` | User | Post message to ticket |
| GET | `/admin/tickets` | Admin | List all tickets |
| GET | `/admin/tickets/:id` | Admin | Get ticket detail |
| PATCH | `/admin/tickets/:id/status` | Admin | Update ticket status |
| POST | `/admin/tickets/:id/reply` | Admin | Post admin reply |

### 6.14 General Registrations (`/api/registrations`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Submit registration |
| POST | `/payment/verify` | Verify Razorpay payment |
| GET | `/payment/sync/:payment_id` | Sync payment status |
| POST | `/webhook` | Razorpay webhook handler |

## 7. File Uploads

All uploaded files are stored on **AWS S3**. Local `uploads/tickets/` is used for ticket attachments only.

| Feature | Files | Middleware |
|---------|-------|------------|
| Internship | Passport photo (image) | `internshipPhotoUpload.js` |
| Mentor | Resume (PDF) + profile photo (image) | `mentorRegistrationUpload.js` |
| MoU | Supporting document | `mouDocumentUpload.js` |
| Hero Slides | Image / video | `heroSlideUpload.js` |
| Workshop | Banner images | `workshopImageUpload.js` |
| Tickets | Attachments | `ticketAttachmentUpload.js` |

## 8. Roles

Defined in `src/constants/roles.js`:

| Role | Value |
|------|-------|
| User | `user` |
| Admin | `admin` |
| Instructor | `instructor` |
| Super Admin | `super_admin` |

Enforced via `authMiddleware.js` (JWT decode), `authAdmin.js`, `authUser.js`, and `requireRole.js`.

## 9. Project Structure

```
src/
  app.js                  # Express app setup, route mounting
  config/
    db.js                 # MySQL pool (bsercDB)
    swagger.js            # Swagger/OpenAPI config
  constants/
    roles.js              # Role constants
  controllers/            # Request handlers
  middleware/
    authMiddleware.js     # JWT decode, attach req.user
    authAdmin.js          # Admin-only guard
    authUser.js           # User-only guard
    requireRole.js        # Role-based guard
    errorHandler.js       # Central error handler
    *Upload.js            # multer upload configs per feature
  models/                 # DB query helpers / table definitions
  routes/                 # Express routers per feature
  services/               # Business logic
    authService.js
    razorpayService.js      # Razorpay order/verify helpers
    s3StorageService.js     # AWS S3 upload/download/presign
    ...
  utils/
    hashPassword.js
    imageProcessing.js    # sharp-based image transforms
    jwt.js
server.js                 # Entry point, DB ping, server start
scripts/
  migrate-internship-passport-photos-to-s3.js
docs/                     # SQL table definitions and migrations
```

## 7. Authentication and Authorization Rules

### 7.1 JWT
- Header format: Authorization: Bearer <token>
- Token expiry: 7 days
- Token payload contains:
  - userId
  - email
  - role

### 7.2 authMiddleware Errors
If header is missing/invalid:
- 401 { "message": "Authorization token required" }

If token is invalid/expired:
- 401 { "message": "Invalid or expired token" }

### 7.3 roleMiddleware Errors
If role is missing:
- 401 { "message": "Unauthorized" }

If role is not allowed:
- 403 { "message": "Forbidden" }

### 7.4 Global Error Handler
Unhandled errors return:
- 500 { "message": "Internal server error" }

## 8. Auth API Details
Base path: /auth

---

### 8.1 Register User
Method and path:
- POST /auth/register

Auth required:
- No

Request body:
- full_name (optional string)
- email (required string)
- password (required string)

Example request:
```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Secret123"
}
```

Success response:
- 201
```json
{
  "message": "User registered successfully"
}
```

Validation/business errors:
- 400 { "message": "Email and password are required" }
- 400 { "message": "User already exists" }

Server error:
- 500 { "message": "Internal server error" }

---

### 8.2 Login
Method and path:
- POST /auth/login

Auth required:
- No

Request body:
- email (required string)
- password (required string)

Example request:
```json
{
  "email": "jane@example.com",
  "password": "Secret123"
}
```

Success response:
- 200
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

Validation/business errors:
- 400 { "message": "Email and password are required" }
- 404 { "message": "User not found" }
- 403 { "message": "Account disabled" }
- 401 { "message": "Invalid password" }

Server error:
- 500 { "message": "Internal server error" }

---

### 8.3 Change Password
Method and path:
- POST /auth/change-password

Auth required:
- Yes (Bearer token)

Request body:
- oldPassword (required string)
- newPassword (required string)

Example request:
```json
{
  "oldPassword": "Secret123",
  "newPassword": "NewSecret456"
}
```

Success response:
- 200
```json
{
  "message": "Password updated successfully"
}
```

Validation/business errors:
- 400 { "message": "Old and new passwords are required" }
- 401 { "message": "Old password is incorrect" }
- 404 { "message": "User not found" }

Auth/controller errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }

Server error:
- 500 { "message": "Internal server error" }

---

### 8.4 Profile
Method and path:
- GET /auth/profile

Auth required:
- Yes (Bearer token)

Success response:
- 200
```json
{
  "user": {
    "id": 1,
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "is_active": 1,
    "created_at": "2026-03-29T00:00:00.000Z",
    "updated_at": "2026-03-29T00:00:00.000Z",
    "last_login": "2026-03-29T00:00:00.000Z"
  }
}
```

Business/auth errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 404 { "message": "User not found" }

Server error:
- 500 { "message": "Internal server error" }

---

### 8.5 Admin Only
Method and path:
- GET /auth/admin-only

Auth required:
- Yes (Bearer token)

Allowed roles:
- admin
- super_admin

Success response:
- 200
```json
{
  "message": "Admin access granted"
}
```

Auth/role errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 403 { "message": "Forbidden" }

---

### 8.6 Instructor Only
Method and path:
- GET /auth/instructor-only

Auth required:
- Yes (Bearer token)

Allowed roles:
- instructor
- super_admin

Success response:
- 200
```json
{
  "message": "Instructor access granted"
}
```

Auth/role errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 403 { "message": "Forbidden" }

## 10. Workshop Registration API Details
Base path: /api/workshop/enrollment

---

### 10.1 Register Workshop Participant
Method and path:
- POST /api/workshop/enrollment

Auth required:
- No

Request body:
- workshop_id or workshopId (optional positive integer, defaults to 1)
- full_name (required string)
- email (required valid email)
- contact_number (required string)
- alternative_email (optional valid email)
- institution (required string)
- designation (required enum: Student, Faculty, Professional)
- agree_recording (required boolean true)
- agree_terms (required boolean true)

Optional payment fields (typically used by payment-verified flows):
- payment_amount
- payment_currency
- razorpay_order_id
- razorpay_payment_id
- payment_status
- payment_mode

Success response:
- 201
```json
{
  "message": "Workshop registration successful",
  "registration": {
    "workshop_id": 1,
    "email": "rahul.sharma@example.com",
    "payment": {
      "amount": 290,
      "currency": "INR",
      "razorpay_order_id": null,
      "razorpay_payment_id": null,
      "status": "pending",
      "mode": null
    }
  }
}
```

Validation/business errors:
- 400 { "message": "workshop_id is required and must be a positive integer" }
- 400 { "message": "full_name, email, contact_number, institution and designation are required" }
- 400 { "message": "Invalid email format" }
- 400 { "message": "Invalid alternative_email format" }
- 400 { "message": "designation must be Student, Faculty, or Professional" }
- 400 { "message": "agree_recording and agree_terms must be true" }
- 404 { "message": "Workshop not found" }
- 409 { "message": "You have already registered for this workshop" }

Server error:
- 500 { "message": "Internal server error" }

---

### 10.2 Create Workshop Payment Order
Method and path:
- POST /api/workshop/enrollment/create-order

Auth required:
- No

Request body:
- workshop_id or workshopId (optional positive integer, defaults to 1)
- email (optional valid email, used for duplicate check)

Success response when payment required:
- 201
```json
{
  "requires_payment": true,
  "key_id": "rzp_test_xxxxx",
  "order_id": "order_xxxxx",
  "amount": 29000,
  "currency": "INR",
  "workshop_id": 1,
  "workshop_title": "Advanced AI Workshop"
}
```

Success response when payment not required (free workshop):
- 200
```json
{
  "requires_payment": false,
  "amount": 0,
  "currency": "INR",
  "workshop_id": 1,
  "workshop_title": "Advanced AI Workshop"
}
```

Success response when already registered:
- 200
```json
{
  "requires_payment": false,
  "already_registered": true,
  "amount": 0,
  "currency": "INR",
  "workshop_id": 1,
  "workshop_title": "Advanced AI Workshop",
  "message": "You have already registered for this workshop"
}
```

Validation/business errors:
- 400 { "message": "workshop_id is required and must be a positive integer" }
- 400 { "message": "Invalid email format" }
- 400 { "message": "Invalid workshop fee configured for this workshop" }
- 404 { "message": "Workshop not found" }

Server errors:
- 500 { "message": "Razorpay credentials are missing on the server" }
- 500 { "message": "Internal server error" }

---

### 10.3 Verify Workshop Payment and Register
Method and path:
- POST /api/workshop/enrollment/verify-payment

Auth required:
- No

Request body (required):
- workshop_id or workshopId (optional positive integer, defaults to 1)
- razorpay_order_id
- razorpay_payment_id
- razorpay_signature
- full_name
- email
- contact_number
- institution
- designation
- agree_recording (true)
- agree_terms (true)

Success response:
- 201
```json
{
  "message": "Payment verified and workshop registration successful",
  "registration": {
    "workshop_id": 1,
    "email": "rahul.sharma@example.com",
    "payment": {
      "amount": 290,
      "currency": "INR",
      "razorpay_order_id": "order_xxxxx",
      "razorpay_payment_id": "pay_xxxxx",
      "status": "captured",
      "mode": "card"
    }
  },
  "payment": {
    "amount": 290,
    "currency": "INR",
    "razorpay_order_id": "order_xxxxx",
    "razorpay_payment_id": "pay_xxxxx",
    "status": "captured",
    "mode": "card"
  }
}
```

Already-registered response:
- 200
```json
{
  "message": "Payment verified. You are already registered for this workshop"
}
```

Validation/business errors:
- 400 { "message": "workshop_id is required and must be a positive integer" }
- 400 { "message": "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" }
- 400 { "message": "Invalid payment signature" }
- 400 { "message": "Unable to validate payment with Razorpay" }
- 400 { "message": "Payment does not belong to this order" }
- 400 { "message": "Paid amount does not match workshop fee" }
- 400 { "message": "Payment is not successful yet (status: ... )" }
- 400 { "message": "Payment is not required for this workshop" }
- 400 { "message": "full_name, email, contact_number, institution and designation are required" }
- 404 { "message": "Workshop not found" }

Server errors:
- 500 { "message": "Razorpay credentials are missing on the server" }
- 500 { "message": "Internal server error" }

## 11. Workshop List API Details
Base path: /api/workshop-list

---

### 11.1 Get Workshop List
Methods and paths:
- GET /api/workshop-list
- GET /api/workshop-list/list (alias)

Auth required:
- No

Success response:
- 200 (array)
```json
[
  {
    "id": 1,
    "title": "Advanced AI Workshop",
    "description": "Hands-on workshop",
    "eligibility": "Students and professionals",
    "mode": "Online",
    "workshop_date": "2026-04-20",
    "start_time": "10:00:00",
    "end_time": "13:00:00",
    "duration": "3 hours",
    "certificate": true,
    "fee": 290,
    "registered_count": 12,
    "thumbnail_url": "/api/workshop-list/1/thumbnail",
    "certificate_url": "/api/workshop-list/1/certificate",
    "has_thumbnail": true,
    "has_certificate_file": true
  }
]
```

Server error:
- 500 { "success": false, "message": "Failed to fetch workshop list" }

---

### 11.2 Get All Workshop Participants
Method and path:
- GET /api/workshop-list/participants

Auth required:
- No

Success response:
- 200
```json
{
  "success": true,
  "participants": [
    {
      "id": 10,
      "workshop_id": 1,
      "workshop_title": "Advanced AI Workshop",
      "full_name": "Rahul Sharma",
      "email": "rahul@example.com",
      "contact_number": "9876543210",
      "institution": "XYZ University",
      "designation": "Student",
      "created_at": "2026-04-04T10:30:00.000Z",
      "created_at_unix": 1775298600
    }
  ]
}
```

Server error:
- 500 { "success": false, "message": "Failed to fetch participants list" }

---

### 11.3 Create Workshop
Method and path:
- POST /api/workshop-list/create

Auth required:
- No

Supported content types:
- application/json
- multipart/form-data

Request fields:
- title (required string)
- description (optional string)
- eligibility (optional string)
- mode (optional string)
- workshop_date (optional YYYY-MM-DD)
- start_time (optional HH:MM:SS)
- end_time (optional HH:MM:SS)
- duration (optional string)
- certificate (optional boolean, default true)
- fee (optional number)
- thumbnail_url (optional valid URL/path)
- certificate_url (optional valid URL/path)

Optional upload fields (multipart/form-data):
- thumbnail (jpg/png/webp, max 2MB)
- certificate (jpg/png/webp, max 2MB)
- certificate_file (alias of certificate, jpg/png/webp, max 2MB)

Success response:
- 201
```json
{
  "success": true,
  "message": "Workshop created successfully"
}
```

Validation/upload errors:
- 400 { "success": false, "message": "Failed to create workshop" }
- 400 { "success": false, "message": "Only image files (jpg, jpeg, png, webp) are allowed." }
- 400 { "success": false, "message": "Unexpected file field. Use thumbnail or certificate (certificate_file alias allowed)." }
- 400 { "success": false, "message": "Too many files uploaded. Provide at most one thumbnail and one certificate." }
- 413 { "success": false, "message": "Image file too large. Max size is 2MB." }

Server error:
- 500 { "success": false, "message": "Failed to create workshop" }

---

### 11.4 Get Workshop By Id
Method and path:
- GET /api/workshop-list/:id

Auth required:
- No

Success response:
- 200 (single workshop object)

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 404 { "success": false, "message": "Workshop not found" }

Server error:
- 500 { "success": false, "message": "Failed to fetch workshop" }

---

### 11.5 Update Workshop By Id
Method and path:
- PUT /api/workshop-list/:id

Auth required:
- No

Supported content types:
- application/json
- multipart/form-data

Behavior:
- Partial update is supported.
- At least one valid field must be provided.
- Uses same validation rules as create endpoint.

Success response:
- 200
```json
{
  "success": true,
  "message": "Workshop updated successfully"
}
```

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 400 { "success": false, "message": "No update fields provided" }
- 400 { "success": false, "message": "Failed to create workshop" }
- 404 { "success": false, "message": "Workshop not found" }
- 413 { "success": false, "message": "Image file too large. Max size is 2MB." }

Server error:
- 500 { "success": false, "message": "Failed to update workshop" }

---

### 11.6 Delete Workshop By Id
Method and path:
- DELETE /api/workshop-list/:id

Auth required:
- No

Success response:
- 200
```json
{
  "success": true,
  "message": "Workshop deleted successfully",
  "deleted_registrations": 8
}
```

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 404 { "success": false, "message": "Workshop not found" }

Server error:
- 500 { "success": false, "message": "Failed to delete workshop" }

---

### 11.7 Get Participants For One Workshop
Method and path:
- GET /api/workshop-list/:id/participants

Auth required:
- No

Success response:
- 200
```json
{
  "success": true,
  "workshop": {
    "id": 1,
    "title": "Advanced AI Workshop"
  },
  "participants": [
    {
      "id": 1,
      "full_name": "Rahul Sharma",
      "email": "rahul@example.com",
      "contact_number": "9876543210",
      "alternative_email": null,
      "institution": "XYZ University",
      "designation": "Student",
      "agree_recording": true,
      "agree_terms": true
    }
  ]
}
```

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 404 { "success": false, "message": "Workshop not found" }

Server error:
- 500 { "success": false, "message": "Failed to fetch workshop participants" }

---

### 11.8 Get Workshop Thumbnail
Method and path:
- GET /api/workshop-list/:id/thumbnail

Auth required:
- No

Success response:
- 200 (Content-Type: image/webp, binary)

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 404 { "success": false, "message": "Workshop image not found" }

Server error:
- 500 { "success": false, "message": "Failed to fetch workshop thumbnail" }

---

### 11.9 Get Workshop Certificate
Method and path:
- GET /api/workshop-list/:id/certificate

Auth required:
- No

Success response:
- 200 (Content-Type: image/webp, binary)

Validation/business errors:
- 400 { "success": false, "message": "Invalid workshop id" }
- 404 { "success": false, "message": "Workshop image not found" }

Server error:
- 500 { "success": false, "message": "Failed to fetch workshop certificate" }

## 12. Mentor API Details
Base path: /api/mentor

---

### 12.1 Register Mentor
Method and path:
- POST /api/mentor/register

Auth required:
- No

Supported content types:
- application/json
- multipart/form-data

Required fields:
- full_name
- email
- phone
- dob (YYYY-MM-DD)

Optional fields:
- nationality (Indian or Others)
- current_position
- organization
- years_experience (integer)
- professional_bio
- primary_track
- secondary_skills
- key_competencies
- video_call (boolean)
- phone_call (boolean)
- live_chat (boolean)
- email_support (boolean)
- availability
- max_students (integer)
- session_duration
- currency (string, e.g. INR or USD)
- honorarium_hourly (number)
- honorarium_daily (number)
- honorarium_weekly (number)
- honorarium_project (number)
- consultation_fee (number)
- price_5_sessions (number)
- price_10_sessions (number)
- price_extended (number)
- complimentary_session (boolean)
- linkedin_url
- portfolio_url
- has_mentored_before (boolean)
- mentoring_experience
- accepted_guidelines (boolean)
- accepted_code_of_conduct (boolean)

Field aliases accepted for compatibility:
- honorariumHourly maps to honorarium_hourly
- honorariumDaily maps to honorarium_daily
- honorariumWeekly maps to honorarium_weekly
- honorariumProject maps to honorarium_project

Currency behavior:
- INR and USD are accepted
- US$, $, and US DOLLAR are normalized to USD
- Rs, ₹, and INDIAN RUPEE are normalized to INR

Nationality behavior:
- Indian and Others are accepted values
- other is normalized to Others

Optional files (multipart/form-data):
- resume (PDF/DOC/DOCX, max 5MB)
- profile_photo (JPG/PNG/WEBP, max 5MB)

Success response:
- 201
```json
{
  "message": "Mentor registered successfully"
}
```

Validation/upload errors:
- 400 { "error": "full_name is required." }
- 400 { "error": "email format is invalid." }
- 400 { "error": "dob must be a valid date in YYYY-MM-DD format." }
- 400 { "error": "years_experience must be an integer." }
- 400 { "error": "max_students must be an integer." }
- 400 { "error": "consultation_fee must be a valid number." }
- 400 { "error": "File too large. Max size is 5MB per file." }
- 400 { "error": "Unexpected file field. Allowed fields are resume and profile_photo." }
- 400 { "error": "Invalid resume file type. Use PDF, DOC, or DOCX." }
- 400 { "error": "Invalid profile photo type. Use JPG, PNG, or WEBP image." }
- 409 { "error": "Email already registered." }

Server error:
- 500 { "error": "Failed to register mentor" }

---

### 12.2 Get Pending Mentor Requests
Method and path:
- GET /api/mentor/requests

Auth required:
- No

Success response:
- 200
```json
{
  "mentors": [
    {
      "id": 1,
      "full_name": "Jane Mentor",
      "email": "jane@example.com",
      "status": "pending"
    }
  ]
}
```

Server error:
- 500 { "error": "Failed to fetch mentor requests" }

---

### 12.3 Get Active Mentor List
Method and path:
- GET /api/mentor/list

Auth required:
- No

Success response:
- 200
```json
{
  "mentors": [
    {
      "id": 2,
      "full_name": "John Mentor",
      "email": "john@example.com",
      "status": "active"
    }
  ]
}
```

Server error:
- 500 { "error": "Failed to fetch mentor list" }

---

### 12.4 Approve Mentor
Method and path:
- PATCH /api/mentor/:id/approve

Auth required:
- No

Success response:
- 200
```json
{
  "message": "Mentor approved successfully",
  "mentor": {
    "id": 1,
    "status": "active"
  }
}
```

Validation/business errors:
- 400 { "error": "Invalid mentor id." }
- 404 { "error": "Mentor not found." }
- 409 { "error": "Mentor is already active." }
- 409 { "error": "Mentor cannot be approved from status: ..." }

Server errors:
- 500 { "error": "Mentor status is not configured. Apply migration: ALTER TABLE mentor_registrations ADD COLUMN status ENUM('pending', 'active') DEFAULT 'pending';" }
- 500 { "error": "Failed to approve mentor" }

---

### 12.5 Reject Mentor
Method and path:
- DELETE /api/mentor/:id/reject

Auth required:
- No

Success response:
- 200
```json
{
  "message": "Mentor rejected and deleted successfully"
}
```

Validation/business errors:
- 400 { "error": "Invalid mentor id." }
- 404 { "error": "Mentor not found." }

Server error:
- 500 { "error": "Failed to reject mentor" }

---

### 12.6 Get Mentor By Id
Method and path:
- GET /api/mentor/:id

Auth required:
- No

Success response:
- 200 (mentor profile object)

Validation/business errors:
- 400 { "error": "Invalid mentor id." }
- 404 { "error": "Mentor not found." }

Server error:
- 500 { "error": "Failed to fetch mentor details" }

---

### 12.7 Get Mentor Resume File
Method and path:
- GET /api/mentor/:id/resume

Auth required:
- No

Success response:
- 200 (binary file; Content-Disposition inline)

Validation/business errors:
- 400 { "error": "Invalid mentor id." }
- 404 { "error": "Mentor not found." }
- 404 { "error": "Resume not found for this mentor." }

Server error:
- 500 { "error": "Failed to fetch mentor file" }

---

### 12.8 Get Mentor Profile Photo
Method and path:
- GET /api/mentor/:id/profile-photo

Auth required:
- No

Success response:
- 200 (binary image; Content-Disposition inline)

Validation/business errors:
- 400 { "error": "Invalid mentor id." }
- 404 { "error": "Mentor not found." }
- 404 { "error": "Profile photo not found for this mentor." }

Server error:
- 500 { "error": "Failed to fetch mentor file" }

## 13. Internship API Details
Base path: /api/internship/registration

---

### 13.1 Create Internship Payment Order
Method and path:
- POST /api/internship/registration/create-order

Auth required:
- No

Request body:
- email (required valid email)

Current fee config:
- Fixed internship application fee is 100 INR.

Success response when payment required:
- 201
```json
{
  "requires_payment": true,
  "key_id": "rzp_test_xxxxx",
  "order_id": "order_xxxxx",
  "amount": 10000,
  "currency": "INR",
  "application_fee": 100
}
```

Success response when already applied:
- 200
```json
{
  "requires_payment": false,
  "already_registered": true,
  "amount": 0,
  "currency": "INR",
  "message": "You have already applied for this internship"
}
```

Success response when fee is zero in config:
- 200
```json
{
  "requires_payment": false,
  "amount": 0,
  "currency": "INR"
}
```

Validation/business errors:
- 400 { "message": "email is required" }
- 400 { "message": "Invalid email format" }

Server errors:
- 500 { "message": "Razorpay credentials are missing on the server" }
- 500 { "message": "Invalid SUMMER_INTERNSHIP_FEE value in server config" }
- 500 { "message": "Internal server error" }

---

### 13.2 Verify Internship Payment and Register
Method and path:
- POST /api/internship/registration/verify-payment

Auth required:
- No

Supported content type:
- multipart/form-data (recommended when uploading passport photo)

Required payment fields:
- razorpay_order_id
- razorpay_payment_id
- razorpay_signature

Required registration fields:
- full_name
- guardian_name
- gender
- dob (YYYY-MM-DD)
- mobile_number (or contact_number)
- email
- address
- city
- state
- pin_code
- institution_name
- educational_qualification
- declaration_accepted (must be true)
- passport_photo (required file)

Optional registration fields:
- internship_name
- internship_designation
- alternative_email

Passport photo upload rules:
- Field name: passport_photo
- Max size: 800KB
- Allowed types: JPG, PNG, WEBP, HEIC, HEIF

Success response:
- 201
```json
{
  "message": "Payment verified and internship application submitted successfully",
  "payment": {
    "razorpay_order_id": "order_xxxxx",
    "razorpay_payment_id": "pay_xxxxx",
    "status": "captured"
  }
}
```

Already-applied response:
- 200
```json
{
  "message": "Payment verified. You have already applied for this internship"
}
```

Validation/business errors:
- 400 { "message": "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required" }
- 400 { "message": "Invalid payment signature" }
- 400 { "message": "Unable to validate payment with Razorpay" }
- 400 { "message": "Payment does not belong to this order" }
- 400 { "message": "Paid amount does not match internship application fee" }
- 400 { "message": "Payment is not successful yet (status: ... )" }
- 400 { "message": "Payment is not required for internship application" }
- 400 { "message": "dob is required in YYYY-MM-DD format" }
- 400 { "message": "declaration_accepted must be true" }
- 400 { "message": "passport_photo is required" }
- 400 { "message": "Invalid photo type. Use JPG, PNG, WEBP, HEIC, or HEIF." }
- 400 { "message": "Unexpected file field. Use passport_photo." }
- 413 { "message": "Passport photo is too large. Max size is 800KB." }

Server errors:
- 500 { "message": "Razorpay credentials are missing on the server" }
- 500 { "message": "Internal server error" }

---

### 13.3 Register Internship Without Payment
Method and path:
- POST /api/internship/registration/register

Auth required:
- No

Purpose:
- Submits internship application without payment only when configured fee is 0.

Request fields:
- Same registration fields and photo rules as section 13.2.

Current behavior with current config:
- Since fixed fee is 100 INR, this endpoint currently returns:
  - 400 { "message": "Payment is required before internship application submission" }

Possible success response when fee is 0:
- 201
```json
{
  "message": "Internship application submitted successfully"
}
```

Validation/business errors:
- 400 validation errors from internship registration rules
- 409 { "message": "You have already applied for this internship" }

Server errors:
- 500 { "message": "Invalid SUMMER_INTERNSHIP_FEE value in server config" }
- 500 { "message": "Internal server error" }

---

### 13.4 Get Internship Applications
Method and path:
- GET /api/internship/registration/list

Auth required:
- No

Success response:
- 200
```json
{
  "applications": [
    {
      "id": 1,
      "internship_name": "Def-Space Summer Internship",
      "internship_designation": "Def-Space Tech Intern",
      "full_name": "Rahul Sharma",
      "email": "rahul@example.com",
      "mobile_number": "9876543210",
      "declaration_accepted": true,
      "has_passport_photo": true,
      "payment_amount": 100,
      "payment_currency": "INR",
      "razorpay_order_id": "order_xxxxx",
      "razorpay_payment_id": "pay_xxxxx",
      "payment_status": "captured",
      "created_at": "2026-04-04 10:30:00",
      "updated_at": "2026-04-04 10:30:00"
    }
  ]
}
```

Server error:
- 500 { "message": "Internal server error" }

## 14. Common Status Codes in This Project
- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 413 Payload Too Large
- 500 Internal Server Error

## 15. Complete Endpoint Index
- GET /
- GET /api-docs
- GET /api-docs.json

- POST /auth/register
- POST /auth/login
- POST /auth/change-password
- GET /auth/profile
- GET /auth/admin-only
- GET /auth/instructor-only

- POST /api/workshop/enrollment
- POST /api/workshop/enrollment/create-order
- POST /api/workshop/enrollment/verify-payment

- GET /api/workshop-list
- GET /api/workshop-list/list
- GET /api/workshop-list/participants
- POST /api/workshop-list/create
- GET /api/workshop-list/:id
- PUT /api/workshop-list/:id
- DELETE /api/workshop-list/:id
- GET /api/workshop-list/:id/participants
- GET /api/workshop-list/:id/thumbnail
- GET /api/workshop-list/:id/certificate

- POST /api/mentor/register
- GET /api/mentor/requests
- GET /api/mentor/list
- PATCH /api/mentor/:id/approve
- DELETE /api/mentor/:id/reject
- GET /api/mentor/:id
- GET /api/mentor/:id/resume
- GET /api/mentor/:id/profile-photo

- POST /api/internship/registration/create-order
- POST /api/internship/registration/verify-payment
- POST /api/internship/registration/register
- GET /api/internship/registration/list

## 16. Recommended End-to-End Test Flow
1. Register and login a user.
2. Call /auth/profile with bearer token.
3. Create workshop with /api/workshop-list/create.
4. Fetch workshop list and workshop by id.
5. Create workshop order with /api/workshop/enrollment/create-order.
6. Verify workshop payment and register via /api/workshop/enrollment/verify-payment.
7. Fetch workshop participants via /api/workshop-list/:id/participants.
8. Register mentor via /api/mentor/register.
9. List mentor requests, approve one, and verify via /api/mentor/list.
10. Create internship order, verify payment, then check /api/internship/registration/list.

## 17. Notes
- Passwords are hashed with bcrypt (salt rounds = 10).
- Auth and API routes are mounted as:
  - /auth
  - /api
- Health endpoint text response is: API is running



