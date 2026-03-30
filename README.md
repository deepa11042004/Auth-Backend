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

## 10. Workshop API Details
Base path: /api

---

### 10.1 Workshop Enrollment
Method and path:
- POST /api/workshop/enrollment

Auth required:
- No

Request body:
- full_name (required string)
- email (required valid email)
- contact_number (required string)
- alternative_email (optional valid email)
- institution (required string)
- designation (required enum: Student, Faculty, Professional)
- agree_recording (required boolean true)
- agree_terms (required boolean true)

Current behavior:
- workshop_id is currently fixed to 1 inside service logic.
- Inserts registration data into workshop_registrations.
- If registration succeeds, it checks users table by email.
- If user does not exist, creates user in users table with:
  - full_name from request
  - email from request
  - password = hashed contact_number (bcrypt)
  - role = user
- All DB steps run in a single transaction.

Example request:
```json
{
  "full_name": "Rahul Sharma",
  "email": "rahul.sharma@example.com",
  "contact_number": "9876543210",
  "alternative_email": "rahul.alt@example.com",
  "institution": "XYZ University",
  "designation": "Student",
  "agree_recording": true,
  "agree_terms": true
}
```

Success response:
- 201
```json
{
  "message": "Workshop registration successful",
  "registration": {
    "workshop_id": 1,
    "email": "rahul.sharma@example.com"
  }
}
```

Validation/business errors:
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

### 10.2 Create Workshop List Entry
Method and path:
- POST /api/workshop-list/create

Auth required:
- No

Request body:
- title (required string)
- description (optional string)
- eligibility (optional string)
- mode (optional string)
- workshop_date (optional string, format YYYY-MM-DD)
- start_time (optional string, format HH:MM:SS)
- end_time (optional string, format HH:MM:SS)
- duration (optional string)
- certificate (optional boolean, defaults to true)
- fee (optional numeric)
- thumbnail_url (optional valid URL or path)
- certificate_url (optional valid URL or path)

Example request:
```json
{
  "title": "Advanced AI Workshop",
  "description": "Hands-on workshop on practical AI use cases",
  "eligibility": "Students and professionals",
  "mode": "Online",
  "workshop_date": "2026-04-20",
  "start_time": "10:00:00",
  "end_time": "13:00:00",
  "duration": "3 hours",
  "certificate": true,
  "fee": 290,
  "thumbnail_url": "/images/workshops/advanced-ai.png",
  "certificate_url": "/certificates/advanced-ai-template.pdf"
}
```

Success response:
- 201
```json
{
  "success": true,
  "message": "Workshop created successfully"
}
```

Validation or database error response:
- 400/500
```json
{
  "success": false,
  "message": "Failed to create workshop"
}
```

## 11. Common Status Codes in This Project
- 200 OK
- 201 Created
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 500 Internal Server Error

## 12. Complete Endpoint Index
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
- POST /api/workshop-list/create

## 13. Recommended End-to-End Test Flow
1. Register a user.
2. Login and copy token.
3. Call profile with token.
4. Create course (instructor/admin/super_admin token).
5. Create section for course.
6. Create lecture for section.
7. Fetch /api/courses.
8. Fetch /api/courses/:slug.
9. Enroll with a learner token.
10. Create workshop list entry with /api/workshop-list/create.
11. Register workshop participant with /api/workshop/enrollment.

## 14. Notes
- Passwords are hashed with bcrypt (salt rounds = 10).
- Auth and LMS APIs are mounted in app as:
  - /auth
  - /api
- Health endpoint text response is: API is running
