# Auth Backend

Simple Express + MySQL authentication API with JWT-based sessions and role-based access control.

## Prerequisites
- Node.js 18+ and npm
- MySQL database

## Environment Variables
Create a `.env` file in the project root:

```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=auth-backend
JWT_SECRET=your_jwt_secret
```

## Install & Run
```
npm install
npm start
```
Server starts on `http://localhost:5000` by default.
Or use api `https://auth-backend-auld.onrender.com`

## Database Schema (users table)
```
users
- id INT PRIMARY KEY AUTO_INCREMENT
- full_name VARCHAR(255) NULL
- email VARCHAR(255) UNIQUE NOT NULL
- password VARCHAR(255) NOT NULL
- role ENUM('user','admin','instructor','super_admin') NOT NULL DEFAULT 'user'
- is_active TINYINT(1) NOT NULL DEFAULT 1
- created_at DATETIME DEFAULT CURRENT_TIMESTAMP
- updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- last_login DATETIME NULL
```

## Base Health Check
- `GET /` → `200 OK` with text `API is running`

## Auth Endpoints
All routes are prefixed with `/auth`.

### Register
- **Endpoint**: `POST /auth/register`
- **Body**:
  ```json
  { "full_name": "Jane Doe", "email": "jane@example.com", "password": "Secret123" }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    { "message": "User registered successfully" }
    ```
  - `400 Bad Request` if email/password missing or user exists.

### Login
- **Endpoint**: `POST /auth/login`
- **Body**:
  ```json
  { "email": "jane@example.com", "password": "Secret123" }
  ```
- **Responses**:
  - `200 OK`:
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
  - `400 Bad Request` if missing fields
  - `404 Not Found` if user missing
  - `403 Forbidden` if `is_active` is false/0
  - `401 Unauthorized` if password invalid

### Change Password
- **Endpoint**: `POST /auth/change-password`
- **Auth**: Bearer token required
- **Body**:
  ```json
  { "oldPassword": "Secret123", "newPassword": "NewSecret456" }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    { "message": "Password updated successfully" }
    ```
  - `400 Bad Request` if fields missing
  - `401 Unauthorized` if token invalid/expired or old password mismatch
  - `404 Not Found` if user missing

### Profile
- **Endpoint**: `GET /auth/profile`
- **Auth**: Bearer token required
- **Responses**:
  - `200 OK`:
    ```json
    {
      "user": {
        "id": 1,
        "full_name": "Jane Doe",
        "email": "jane@example.com",
        "role": "user",
        "is_active": 1,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-02T00:00:00.000Z",
        "last_login": "2024-02-01T12:00:00.000Z"
      }
    }
    ```
  - `401 Unauthorized` if token invalid/expired
  - `404 Not Found` if user missing

### Admin Only
- **Endpoint**: `GET /auth/admin-only`
- **Auth**: Bearer token required; roles allowed: `admin`, `super_admin`
- **Responses**:
  - `200 OK`:
    ```json
    { "message": "Admin access granted" }
    ```
  - `401 Unauthorized` if no/invalid token
  - `403 Forbidden` if role not permitted

### Instructor Only
- **Endpoint**: `GET /auth/instructor-only`
- **Auth**: Bearer token required; roles allowed: `instructor`, `super_admin`
- **Responses**:
  - `200 OK`:
    ```json
    { "message": "Instructor access granted" }
    ```
  - `401 Unauthorized` if no/invalid token
  - `403 Forbidden` if role not permitted

## Authorization
- Send `Authorization: Bearer <token>` header for protected routes.
- Tokens are valid for 7 days (`exp` set in JWT).

## Passwords & Hashing
- Passwords are hashed with bcrypt (`SALT_ROUNDS = 10`).

## Error Handling
- Unhandled errors return `500 Internal server error` JSON via the global error handler.

## Quick Test with curl
```
# Register
curl -X POST http://localhost:5000/auth/register \ 
  -H "Content-Type: application/json" \ 
  -d '{"full_name":"Jane Doe","email":"jane@example.com","password":"Secret123"}'

# Login
curl -X POST http://localhost:5000/auth/login \ 
  -H "Content-Type: application/json" \ 
  -d '{"email":"jane@example.com","password":"Secret123"}'

# Profile (replace TOKEN)
curl http://localhost:5000/auth/profile \ 
  -H "Authorization: Bearer TOKEN"
```
