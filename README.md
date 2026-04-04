# BSERC Auth and LMS Backend API

Node.js + Express backend with JWT authentication and LMS course APIs using MySQL.

## 1. What This Backend Provides
- Authentication APIs:
  - register
  - login
  - change password
  - profile
  - admin-only route
  - instructor-only route
- LMS APIs:
  - published courses list
  - full course details by slug
  - create course
  - create section
  - create lecture
  - enroll in course
- Workshop APIs:
  - workshop enrollment
  - workshop list creation
- Swagger docs at runtime
- Role-based authorization
- Two database pools

## 2. Tech Stack
- Node.js
- Express
- mysql2/promise
- jsonwebtoken
- bcrypt
- swagger-jsdoc
- swagger-ui-express

## 3. Database Architecture
Two pools are used:

1. bsercDB
- Purpose: users/auth data
- Database: bserc_core_db

2. lmsDB
- Purpose: LMS data
- Database: lms_core_db

### 3.1 Tables Used
bserc_core_db:
- users
- workshop_list
- workshop_registrations

lms_core_db:
- courses
- sections
- lectures
- lecture_resources
- enrollments
- ratings
- requirements
- learning_outcomes

## 4. Environment Variables
Create a .env file in project root.

### 4.1 Core Variables
- PORT=5000
- JWT_SECRET=your_secret
- DB_HOST=127.0.0.1
- DB_PORT=3306
- DB_USER=root
- DB_PASSWORD=your_db_password
- DB_NAME=bserc_core_db

### 4.2 Optional Split Credentials (Recommended)
- BSERC_DB_HOST=127.0.0.1
- BSERC_DB_PORT=3306
- BSERC_DB_USER=root
- BSERC_DB_PASSWORD=your_bserc_db_password
- BSERC_DB_NAME=bserc_core_db

- LMS_DB_HOST=127.0.0.1
- LMS_DB_PORT=3306
- LMS_DB_USER=root
- LMS_DB_PASSWORD=your_lms_db_password
- LMS_DB_NAME=lms_core_db

- DB_CONNECTION_LIMIT=10

### 4.3 Fallback Logic
- bsercDB: BSERC_* -> DB_* -> defaults
- lmsDB: LMS_* -> DB_* -> defaults

## 5. Install and Run
1. npm install
2. npm start

Server default:
- http://localhost:5000

## 6. Runtime Endpoints
- Health: GET /
- Swagger UI: GET /api-docs
- OpenAPI JSON: GET /api-docs.json

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

## 9. LMS API Details
Base path: /api

---

### 9.1 Get Published Courses
Method and path:
- GET /api/courses

Auth required:
- No

Optional query params:
- page (positive integer)
- limit (positive integer, max 100)

Behavior:
- Only courses where status = published are returned.
- rating is AVG from ratings table (rounded to 1 decimal in SQL).
- enrolledStudents is computed from enrollments count.

Response mode A (no page and no limit):
- Returns array directly

Example:
```json
[
  {
    "id": 1,
    "title": "Node Course",
    "slug": "node-course",
    "thumbnail": "https://cdn.example.com/thumb.jpg",
    "price": 499,
    "rating": 4.6,
    "enrolledStudents": 120
  }
]
```

Response mode B (when page or limit is provided):
- Returns object with courses and pagination

Example:
```json
{
  "courses": [
    {
      "id": 1,
      "title": "Node Course",
      "slug": "node-course",
      "thumbnail": "https://cdn.example.com/thumb.jpg",
      "price": 499,
      "rating": 4.6,
      "enrolledStudents": 120
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Server error:
- 500 { "message": "Internal server error" }

---

### 9.2 Get Course Detail by Slug (Main API)
Method and path:
- GET /api/courses/:slug

Auth required:
- No

Behavior:
- Returns only published course.
- Combines data from:
  - courses
  - sections
  - lectures
  - lecture_resources
  - enrollments
  - ratings
  - requirements
  - learning_outcomes
  - users (instructor from bserc_core_db)
- Groups lectures under sections.
- Sorts by section order and lecture order.
- Deduplicates resources.
- Computes duration and totalLectures dynamically (falls back to stored values if needed).

Success response:
- 200
```json
{
  "id": 1,
  "slug": "node-course",
  "title": "Node Course",
  "subtitle": "Build APIs",
  "description": {
    "short": "Short description",
    "long": "Long description"
  },
  "category": "Programming",
  "level": "Beginner",
  "language": "English",
  "thumbnail": "https://cdn.example.com/thumb.jpg",
  "previewVideoUrl": "https://cdn.example.com/preview.mp4",
  "price": 499,
  "isPaid": true,
  "rating": 4.6,
  "enrolledStudents": 120,
  "duration": 340,
  "totalLectures": 28,
  "requirements": [
    "Basic computer knowledge"
  ],
  "learningOutcomes": [
    "Build REST APIs"
  ],
  "instructor": {
    "id": 5,
    "name": "Jane Instructor",
    "avatar": null
  },
  "curriculum": [
    {
      "id": 10,
      "title": "Introduction",
      "order": 1,
      "lectures": [
        {
          "id": 101,
          "title": "Welcome",
          "order": 1,
          "durationMinutes": 8,
          "videoUrl": "https://cdn.example.com/lec1.mp4",
          "isPreview": true,
          "resources": [
            {
              "id": 1001,
              "type": "pdf",
              "title": "Slide deck",
              "url": "https://cdn.example.com/slide.pdf"
            }
          ]
        }
      ]
    }
  ]
}
```

Business errors:
- 404 { "message": "Course not found" }

Server error:
- 500 { "message": "Internal server error" }

---

### 9.3 Create Course
Method and path:
- POST /api/courses

Auth required:
- Yes (Bearer token)

Allowed roles:
- instructor
- admin
- super_admin

Minimum required body fields:
- title
- slug

Accepted body fields (with aliases):
- subtitle
- description.short or description_short
- description.long or description_long
- category
- level
- language
- thumbnail
- thumbnail_small
- thumbnail_medium
- thumbnail_large
- previewVideoUrl or preview_video_url
- price
- isPaid or is_paid
- discountPrice or discount_price
- currency
- lifetimeAccess or lifetime_access
- certificateAvailable or certificate_available
- status
- visibility
- instructorId or instructor_id
- programId or program_id

Field rules:
- level must be one of: Beginner, Intermediate, Advanced
- status must be one of: draft, published, pending
- visibility must be one of: public, private, unlisted
- if isPaid=true then price is required
- instructor users can only create under their own userId

Example request:
```json
{
  "title": "Node Masterclass",
  "slug": "node-masterclass",
  "subtitle": "From zero to API deployment",
  "description": {
    "short": "Short summary",
    "long": "Full detailed description"
  },
  "category": "Programming",
  "level": "Beginner",
  "language": "English",
  "thumbnail": "https://cdn.example.com/course.jpg",
  "previewVideoUrl": "https://cdn.example.com/preview.mp4",
  "isPaid": true,
  "price": 999,
  "discountPrice": 799,
  "currency": "INR",
  "status": "draft",
  "visibility": "public"
}
```

Success response:
- 201
```json
{
  "message": "Course created successfully",
  "course": {
    "id": 1,
    "title": "Node Masterclass",
    "slug": "node-masterclass",
    "status": "draft",
    "instructor_id": 5
  }
}
```

Business errors:
- 400 { "message": "title and slug are required" }
- 400 { "message": "Invalid level value" }
- 400 { "message": "price is required for paid courses" }
- 400 { "message": "Invalid status value" }
- 400 { "message": "Invalid visibility value" }
- 400 { "message": "Valid instructor_id is required" }
- 404 { "message": "Instructor not found" }
- 409 { "message": "slug already exists" }

Auth/role errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 403 { "message": "Forbidden" }

Server error:
- 500 { "message": "Internal server error" }

---

### 9.4 Create Section
Method and path:
- POST /api/sections

Auth required:
- Yes (Bearer token)

Allowed roles:
- instructor
- admin
- super_admin

Request body:
- course_id or courseId (required)
- title (required)
- order (optional, defaults to 1 if invalid/missing)

Example request:
```json
{
  "course_id": 1,
  "title": "Getting Started",
  "order": 1
}
```

Success response:
- 201
```json
{
  "message": "Section created successfully",
  "section": {
    "id": 10,
    "course_id": 1,
    "title": "Getting Started",
    "order": 1
  }
}
```

Business errors:
- 400 { "message": "course_id and title are required" }
- 404 { "message": "Course not found" }

Auth/role errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 403 { "message": "Forbidden" }

Server error:
- 500 { "message": "Internal server error" }

---

### 9.5 Create Lecture
Method and path:
- POST /api/lectures

Auth required:
- Yes (Bearer token)

Allowed roles:
- instructor
- admin
- super_admin

Request body:
- section_id or sectionId (required)
- title (required)
- order (optional, defaults to 1)
- duration or duration_minutes (optional, defaults to 0)
- video_url or videoUrl (optional)
- isPreview or is_preview (optional, defaults to false)

Example request:
```json
{
  "section_id": 10,
  "title": "Install Node",
  "order": 1,
  "duration": 12,
  "video_url": "https://cdn.example.com/install-node.mp4",
  "isPreview": true
}
```

Success response:
- 201
```json
{
  "message": "Lecture created successfully",
  "lecture": {
    "id": 101,
    "section_id": 10,
    "title": "Install Node",
    "order": 1,
    "durationMinutes": 12,
    "videoUrl": "https://cdn.example.com/install-node.mp4",
    "isPreview": true
  }
}
```

Business errors:
- 400 { "message": "section_id and title are required" }
- 404 { "message": "Section not found" }

Auth/role errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }
- 401 { "message": "Unauthorized" }
- 403 { "message": "Forbidden" }

Server error:
- 500 { "message": "Internal server error" }

---

### 9.6 Enroll in Course
Method and path:
- POST /api/enroll

Auth required:
- Yes (Bearer token)

Request body:
- course_id or courseId (required)

Behavior:
- user_id is taken from JWT payload (userId)
- prevents duplicate enrollments
- updates courses.enrolled_students aggregate count

Example request:
```json
{
  "course_id": 1
}
```

Success response:
- 201
```json
{
  "message": "Enrollment successful",
  "enrollment": {
    "user_id": 7,
    "course_id": 1
  }
}
```

Business errors:
- 400 { "message": "course_id is required" }
- 400 { "message": "Only published courses can be enrolled" }
- 404 { "message": "User not found" }
- 404 { "message": "Course not found" }
- 409 { "message": "Already enrolled in this course" }
- 401 { "message": "Unauthorized" }

Auth errors:
- 401 { "message": "Authorization token required" }
- 401 { "message": "Invalid or expired token" }

Server error:
- 500 { "message": "Internal server error" }

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

- GET /api/courses
- GET /api/courses/:slug
- POST /api/courses
- POST /api/sections
- POST /api/lectures
- POST /api/enroll

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
3. Create course, section, and lecture using instructor/admin role token.
4. Fetch /api/courses and /api/courses/:slug.
5. Enroll in course using /api/enroll.
6. Create workshop with /api/workshop-list/create.
7. Fetch workshop list and workshop by id.
8. Create workshop order with /api/workshop/enrollment/create-order.
9. Verify workshop payment and register via /api/workshop/enrollment/verify-payment.
10. Fetch workshop participants via /api/workshop-list/:id/participants.
11. Register mentor via /api/mentor/register.
12. List mentor requests, approve one, and verify via /api/mentor/list.
13. Create internship order, verify payment, then check /api/internship/registration/list.

## 17. Notes
- Passwords are hashed with bcrypt (salt rounds = 10).
- Auth and API routes are mounted as:
  - /auth
  - /api
- Health endpoint text response is: API is running
