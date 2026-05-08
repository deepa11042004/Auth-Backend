# System Architecture Documentation

## 1. Project Overview

### Purpose & Business Problem
The BSERC (Bharat Space Education Research Centre) application platform is a comprehensive educational ecosystem built to manage institutional registrations, summer schools, workshops, internship programs, and mentorships. It bridges the gap between educational content delivery and operational management, providing seamless registration flows, secure online payments, and centralized administrative control.

### Target Users
- **Students & Professionals:** Registering for workshops, internships, and summer schools.
- **Educational Institutions:** Managing MOUs, applying for partnerships, and institutional registrations.
- **Administrators (Super Admins, Admins):** Managing workshops, verifying payments, processing applications, and sending bulk email communications.
- **Mentors:** Applying and managing mentor profiles.

### Main System Modules
1. **Authentication & Authorization Module:** Role-based access control (RBAC).
2. **Registration Engines:** Workshops, internships, summer schools, mentors, institutions, and MOUs.
3. **Payment Gateway Module:** Integrated Razorpay with robust reconciliation and retry systems.
4. **Communication Module:** Advanced bulk email management, template storage, and delivery status tracking.
5. **Admin Dashboard:** Centralized management via a protected super-admin interface.

### System Goals
- **Scalability:** Handle traffic spikes during workshop announcements using stateless scaling.
- **Reliability:** Implement heavy payment reconciliation and retry loops to prevent drop-offs.
- **Performance:** Ensure fast page loads using Next.js Server-Side Rendering (SSR) and edge-middleware.
- **Security:** Guard all admin routes with JWT-based cookies and edge proxying, secure direct raw SQL execution against injection, and strict role enforcement.

---

## 2. High-Level System Architecture 

![System Architecture](./Sys_architecture.svg)

The project employs a **Decoupled Monolithic Architecture**, cleanly splitting a robust React-based Frontend from an Express-based REST API backend. 

- **Frontend (Client Layer):** Next.js App Router application handling UI, form validation, state management, and edge-level route guarding.
- **Backend (API Layer):** Node.js/Express monolithic backend managing business logic, payment verification, direct database interactions, and secure file uploads.
- **Data Layer:** A centralized MySQL database (`bserc_core_db`) heavily utilizing connection pooling.
- **Storage Layer:** Dual-storage architecture utilizing both Local Disk (via Multer) and Cloud Object Storage (AWS S3) for scalable document and media storage.

### Component Interaction Flow
1. **Client -> Frontend Next.js Server:** User navigates to a route. Next.js returns statically generated, server-rendered, or client-rendered pages based on configuration.
2. **Frontend -> Edge Proxy:** Requests hitting `/admin/*` are intercepted by Next.js Edge Middleware (`proxy.ts`) which validates JWT cookies before allowing access.
3. **Frontend -> Backend API:** Client components use `api.ts` (fetch wrapper) to call Express REST endpoints (`/api/...`).
4. **Backend -> Database/External Services:** Express controllers hand off to service layers which interact with MySQL or external APIs like Razorpay and AWS S3.

---

## 3. Technology Stack

### Frontend Framework
- **Next.js (App Router):** Chosen for SSR capabilities, optimal SEO, automatic code-splitting, and built-in edge middleware.
- **React 18:** Core UI library for component-based architecture.
- **Tailwind CSS & Shadcn UI:** For highly customizable, utility-first, and accessible design system implementation.
- **Lucide React:** Scalable SVG iconography.
- **React Hook Form & Zod:** Schema-based form validation to prevent malformed data from hitting the backend.

### Backend Framework
- **Node.js & Express.js:** Lightweight and high-performance server for building RESTful APIs. Chosen for its massive ecosystem and ease of asynchronous I/O handling.
- **Swagger (swagger-jsdoc & swagger-ui-express):** For self-documenting API architectures and engineering onboarding.

### Database & Storage
- **MySQL 2 (mysql2/promise):** Chosen for robust relational data integrity. Used with raw SQL and parameterized queries rather than an ORM to maintain strict control over query optimization and performance.
- **AWS S3 (@aws-sdk/client-s3):** Highly scalable cloud object storage for immutable assets like passport photos, MOUs, and certificates.

### Authentication & Security
- **JSON Web Tokens (JWT):** Stateless authentication mechanism.
- **Bcrypt:** For secure, salted password hashing.
- **Next.js Edge Middleware:** For zero-latency route protection.

### Integrations
- **Razorpay:** For processing INR transactions. Chosen for its reliability in the Indian market and comprehensive API.
- **Nodemailer:** For reliable outbound SMTP communication.

### DevOps & Deployment
- **Docker & Docker Compose:** Containerization for consistent environments across development and production.
- **Next.js Standalone Build:** Optimizes the Docker image footprint by copying only essential files.

---

## 4. Frontend Architecture

### Folder Structure
```text
nextjs-bserc/src/
├── app/               # Next.js App Router pages and layouts
│   ├── (admin)/       # Route group for admin dashboard (uses proxy middleware)
│   ├── (site)/        # Route group for public marketing/informational pages
│   ├── api/           # Next.js Route Handlers (BFF - Backend for Frontend proxy)
│   └── layout.tsx     # Root layout wrapping AuthContext
├── components/        # Reusable UI components (Shadcn, custom components)
├── context/           # React Context Providers (AuthContext.tsx)
├── data/              # Static data constants
├── hooks/             # Custom React hooks
├── lib/               # Utilities (auth helpers, formatting, etc.)
├── services/          # API wrapper classes (api.ts, emailServer.ts)
├── proxy.ts           # Next.js Edge Middleware for route protection
└── types/             # TypeScript interfaces and type definitions
```

### State Management & Authentication Handling
Authentication state is managed by a centralized `AuthContext`. It supports dual scopes (`user` vs `admin`) and avoids session collision. 
Tokens are redundantly stored in `localStorage` (for client-side hydration) and `Cookies` (for Next.js Middleware and SSR access). 

### Routing System & Edge Middleware
Routing leverages the Next.js App Router (`/app`). The `src/proxy.ts` acts as a middleware interceptor for all `/admin/*` routes. It parses the `adminAuthToken` cookie and decodes the JWT role without hitting the backend, drastically reducing server load and eliminating flash-of-unauthenticated-content.

### Backend-for-Frontend (BFF) API Layer
The `src/app/api/` folder contains Next.js Route Handlers that securely proxy requests to the underlying Express API or Email server, hiding backend URIs and injecting server-side secrets when necessary.

---

## 5. Backend Architecture

### Folder Structure
```text
Auth-backend/src/
├── app.js               # Express application setup, global middleware, route registration
├── config/              # Configuration (db.js connection pooling, swagger.js)
├── constants/           # Global constants (Roles)
├── controllers/         # HTTP request/response handlers
├── middleware/          # Express middleware (authMiddleware, roleMiddleware, errorHandling, uploads)
├── models/              # Raw SQL query definitions / schemas
├── routes/              # Express Router definitions
├── services/            # Core business logic (Razorpay integrations, registration logic)
└── utils/               # Helpers (JWT generation, password hashing)
```

### Layered Architecture Design
The backend strictly follows a layered architectural pattern to separate concerns:
1. **Routes Layer:** Maps HTTP verbs and endpoints to specific controllers. Applies route-specific middleware (e.g., `authMiddleware`, `multer` upload handlers).
2. **Controller Layer:** Extracts data from `req.body` and `req.params`, passes it to the Service layer, and formats the `res.json` response.
3. **Service Layer:** The "Brain" of the backend. Contains business rules, transactional logic, third-party API interactions (Razorpay), and complex data reconciliation.
4. **Data Access Layer (Config/DB):** Uses `mysql2/promise` connection pooling. The codebase intentionally avoids ORMs in favor of highly optimized, parameterized raw SQL queries.

### Request Lifecycle
`Client Request` -> `app.js (CORS/JSON)` -> `Route (e.g., workshopRoutes.js)` -> `Middleware (Auth/Role Validation)` -> `Controller` -> `Service (Business Logic / DB execution)` -> `Controller (Response formatting)` -> `Client Response`.

---

## 6. Database Architecture

### Design Strategy
The database (`bserc_core_db`) is a highly relational MySQL database. 
- **Connection Pooling:** Managed centrally in `src/config/db.js` (`connectionLimit: 10`). This prevents connection exhaustion under high load.
- **Raw SQL Queries:** Used extensively in the Service layer (e.g., `workshopRegistrationService.js`). Parameters are always passed as bound variables (`?`) to completely eliminate SQL injection vectors.
- **Graceful Schema Evolution:** Services include silent auto-migration functions (e.g., `ensureCountryColumn()`, `ensureDesignationSupportsOthers()`) which dynamically alter table schemas during runtime if columns are missing. This is a unique, highly resilient architectural decision for handling legacy deployments.

---

## 7. Authentication & Authorization Architecture

### JWT Lifecycle
1. **Login Flow:** User submits credentials -> Backend validates via `bcrypt` -> Backend generates a signed JWT containing the `userId` and `role`.
2. **Frontend Storage:** `AuthContext` receives the token and stores it in both `localStorage` (key: `userToken`/`adminToken`) and a `Secure; SameSite=Lax` Cookie.
3. **Authorization:** 
   - *Frontend:* `proxy.ts` reads the cookie and verifies expiration and role before rendering pages.
   - *Backend:* `authMiddleware.js` intercepts the `Authorization: Bearer <token>` header, decodes it, and attaches `req.user`. `roleMiddleware.js` further checks if `req.user.role` matches required access levels.

### RBAC System
Roles include `student`, `user`, `admin`, and `super_admin`. Strict boundary separation exists; an admin login will invalidate an existing user session on the frontend to prevent privilege escalation or state corruption.

---

## 8. API Architecture

- **RESTful Principles:** The backend uses standard REST verbs (GET, POST, PUT, DELETE).
- **Documentation:** Fully documented using Swagger. The `swagger.js` configuration dynamically reads JSDoc comments from the `src/routes/` folder and exposes `/api-docs` using `swagger-ui-express`.
- **API Client:** The frontend abstracts all API calls through `src/services/api.ts`. It includes an `ApiError` class that seamlessly catches and parses backend error responses, allowing UI components to handle 400/500 level errors cleanly.

---

## 9. File Storage & Media Architecture

The system utilizes a Hybrid Storage Architecture depending on the sensitivity and required scale of the file:
1. **Local Storage (Multer):** Temporary or less critical files are uploaded via Multer to the local `/uploads` directory. Served statically via Express `app.use('/uploads', express.static(...))`.
2. **Cloud Storage (AWS S3):** Critical files (Internship Passports, MOUs) are uploaded directly to S3 using `@aws-sdk/client-s3`. 
   - Migration scripts (e.g., `migrate-internship-passport-photos-to-s3.js`) exist to move legacy local files to the cloud seamlessly.

---

## 10. Queue & Background Job Architecture

While a traditional Redis/RabbitMQ setup is not present in the Express monolith, the system handles background processing via specialized externalized email APIs. 
- **Bulk Email Service:** `emailServer.ts` acts as an SDK communicating with an advanced Campaign engine. 
- **Features:** It tracks `CampaignStats`, manages `SuppressionEntry` lists, provides a `testSend` feature, and includes sophisticated administrative endpoints to `retryFailedForCampaign(campaignId)` or `retryRecipient(recipientId)`. This indicates a highly asynchronous, queue-backed architecture dedicated solely to notifications.

---

## 11. Security Architecture

- **SQL Injection Prevention:** 100% reliance on parameterized queries (`mysql2` prepared statements).
- **XSS Prevention:** Next.js automatically escapes injected content. HTML sanitization is handled via `dompurify` and `jsdom` where rich text is rendered.
- **CORS:** Configured globally in `app.js` to prevent cross-origin exploitation.
- **Data Encryption:** Passwords hashed with `bcrypt`. Razorpay signatures validated using SHA256 HMAC (`crypto.createHmac`) to prevent payment spoofing.
- **Secure Middleware:** API endpoints dynamically require `authMiddleware` and `requireRole(['admin'])`.

---

## 12. Payment Architecture (Razorpay)

The payment flow implemented in `workshopRegistrationService.js` is incredibly robust and enterprise-ready:
1. **Order Creation:** Backend validates payload -> Calculates `amountInPaise` -> Calls Razorpay `orders.create`.
2. **Payment Verification:** Frontend completes payment -> Sends `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` to backend.
3. **Cryptographic Validation:** Backend verifies signature using `crypto.timingSafeEqual` to prevent timing attacks.
4. **Resiliency & Retry:** 
   - If a payment verification is requested but Razorpay hasn't propagated the status yet, `fetchPaymentFromRazorpayWithRetry` triggers.
   - It polls Razorpay up to **6 times** with a **1200ms delay** to ensure transient statuses (`created`, `pending`) are resolved to `captured` before failing the user.
5. **Reconciliation (`reconcilePendingWorkshopRegistration`):** If a user drops off after paying but before the frontend returns the signature, the backend can retrospectively query Razorpay to finalize the registration upon their next interaction.

---

## 13. Deployment & Infrastructure Architecture

### Docker Containerization
Both the frontend and backend are fully containerized.
- **Backend Dockerfile:** Uses `node:20-alpine`. Simple install and start. Exposes port 5000.
- **Frontend Dockerfile:** Implements a highly optimized, 3-stage build process:
  1. `deps`: Installs dependencies using `npm ci`.
  2. `builder`: Copies files and runs `next build`. Passes `API_URL` as a build argument.
  3. `runner`: Sets up a **non-root user** (`nextjs:nodejs`) for extreme container security. Copies only the `.next/standalone` folder.

### Production Execution
The frontend runs via the standalone Node.js server rather than `next start`, significantly reducing memory footprint. `docker-compose.yml` binds the frontend to port 3000 and maps environmental variables dynamically.

---

## 14. Scalability Architecture

- **Stateless Backend:** JWT authentication ensures the Express API stores no session state, allowing for horizontal scaling behind a Load Balancer (e.g., NGINX, AWS ALB).
- **Stateless Frontend:** Next.js SSR is stateless. `proxy.ts` evaluates JWTs at the edge without querying the database, making routing infinitely scalable.
- **Database Scaling:** Connection pooling ensures the database isn't overwhelmed. Future scaling can be achieved via Read-Replicas since queries are explicitly structured.

---

## 15. Engineering Decisions & Tradeoffs

1. **Tradeoff: Raw SQL vs. ORM:**
   - *Decision:* Used raw `mysql2` queries.
   - *Reasoning:* Maximum performance, fine-grained control over complex aggregations, and avoidance of ORM N+1 query problems. 
   - *Tradeoff:* Requires more boilerplate code and manual schema migration logic built into the services.
2. **Tradeoff: Next.js Edge Proxy vs. Backend Verification:**
   - *Decision:* Verify `admin` JWT tokens via Edge Middleware (`proxy.ts`).
   - *Reasoning:* Prevents unauthorized users from ever downloading the admin JS bundles. Massive performance win.
   - *Tradeoff:* Requires strict sync between backend JWT signing logic and frontend token expiration tracking.
3. **Tradeoff: Hybrid File Storage:**
   - *Decision:* Maintain local `/uploads` support alongside AWS S3.
   - *Reasoning:* Enables local development without AWS credentials while ensuring production can scale infinitely.

---

## 16. Conclusion & Production Readiness

The BSERC system architecture is built to **high enterprise standards**. 
- **Reliability** is heavily emphasized through Razorpay retry-loops and backend order reconciliation. 
- **Security** is meticulously handled via Next.js Edge Middleware, non-root Docker execution, parameterized raw SQL, and cryptographic payment verification.
- **Maintainability** is achieved through strict layered monolithic architecture, self-documenting Swagger APIs, and typed React frontend interfaces.

The platform is **Production-Ready**, highly scalable, and architecturally sound for long-term expansion.
