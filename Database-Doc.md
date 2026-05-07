# Database Documentation

## Overview
This document describes the database schema used in the Auth-Backend. The database is a relational database system using **MySQL**, and it primarily uses raw SQL queries to interact with the tables rather than an Object-Relational Mapper (ORM).

The system handles various features such as user management, contact queries, content management (hero slides, footer news), and event/program registrations (institutions, students, MoU requests).

---

## 1. Core Administration

### `users`
**Purpose:** Stores administrative and system users who manage the backend platform.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `full_name` | VARCHAR | | User's full name. |
| `email` | VARCHAR | | User's email address (used for login). |
| `password` | VARCHAR | | Hashed password. |
| `role` | VARCHAR | | User's role in the system (e.g., `admin`, `user`). |
| `is_active` | BOOLEAN | | Status of the user account. |
| `last_login` | TIMESTAMP | | Date and time of the last successful login. |
| `created_at` | TIMESTAMP | | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

---

## 2. Content Management & Communications

### `contact_queries`
**Purpose:** Stores inquiries submitted by users through the contact form. It tracks if the query has been resolved by an administrator.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `full_name` | VARCHAR(255) | | Name of the inquirer. |
| `email` | VARCHAR(255) | Indexed | Email of the inquirer. |
| `phone` | VARCHAR(30) | | Phone number. |
| `subject` | VARCHAR(200) | | Subject of the inquiry. |
| `message` | TEXT | | The inquiry content. |
| `source_path` | VARCHAR(255) | | The page URL from which the query was submitted. |
| `is_solved` | TINYINT(1) | | Boolean flag (0/1) indicating if the query is resolved. Default 0. |
| `solved_at` | TIMESTAMP | | Date and time when marked as solved. |
| `created_at` | TIMESTAMP | Indexed | Record creation timestamp. Default CURRENT_TIMESTAMP. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

### `footer_news_updates`
**Purpose:** Manages the dynamic news or updates links displayed in the footer section of the website.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `title` | VARCHAR(255) | | The display text of the news/update. |
| `link` | TEXT | | The URL destination. |
| `is_active` | TINYINT(1) | Indexed* | Boolean flag (0/1) for visibility. Default 1. |
| `position` | INT | Indexed* | Used for ordering the items. |
| `created_at` | TIMESTAMP | | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

*\* Note: There is a composite index on `(is_active, position)` and a single index on `(position)`.*

### `hero_slides`
**Purpose:** Stores the content for the hero carousel/slider on the frontend. Supports both images and videos stored directly as BLOBs.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `title` | VARCHAR(255) | | Slide main title. |
| `subtitle` | TEXT | | Slide subtitle. |
| `description` | TEXT | | Detailed description. |
| `badge_text` | VARCHAR(120) | | Small badge or tag text. |
| `media_type` | ENUM | | Type of media (`'image'`, `'video'`). |
| `media_data` | LONGBLOB | | The actual binary data of the media file. |
| `media_mime_type` | VARCHAR(120) | | MIME type (e.g., `image/png`, `video/mp4`). |
| `cta_text` | VARCHAR(255) | | Primary Call to Action button text. |
| `cta_link` | TEXT | | Primary Call to Action link. |
| `secondary_cta_text`| VARCHAR(255) | | Secondary Call to Action button text. |
| `secondary_cta_link`| TEXT | | Secondary Call to Action link. |
| `is_active` | TINYINT(1) | Indexed* | Visibility flag. Default 1. |
| `position` | INT | Indexed* | Ordering position. |
| `created_at` | TIMESTAMP | | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

*\* Note: There is a composite index on `(is_active, position)` and a single index on `(position)`.*

---

## 3. Registrations & Applications

### `institutional_registrations`
**Purpose:** Manages registrations from educational institutions (e.g., schools) including tracking Razorpay payment transactions.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `institute_name` | VARCHAR(255) | | Name of the institution. |
| `board` | VARCHAR(120) | | Board of education. |
| `city` | VARCHAR(120) | | City. |
| `state` | VARCHAR(120) | | State. |
| `pin_code` | VARCHAR(20) | | Pin code / Zip code. |
| `country` | VARCHAR(120) | | Country (Default: India). |
| `contact_name` | VARCHAR(255) | | Primary contact person name. |
| `designation` | VARCHAR(120) | | Designation of the contact person. |
| `email` | VARCHAR(255) | Indexed | Contact person's email address. |
| `phone` | VARCHAR(30) | | Contact person's phone number. |
| `student_count` | VARCHAR(80) | | Estimated number of students. |
| `head_name` | VARCHAR(255) | | Name of the institution's head/principal. |
| `head_email` | VARCHAR(255) | Indexed | Email of the institution's head/principal. |
| `head_phone` | VARCHAR(30) | | Phone of the institution's head/principal. |
| `message` | TEXT | | Additional comments. |
| `payment_status` | ENUM | | Status (`success`, `failed`, `pending`). Default `pending`. |
| `payment_amount` | DECIMAL(10,2) | | Amount paid. |
| `payment_currency` | VARCHAR(10) | | Currency code (e.g., `INR`). |
| `razorpay_order_id` | VARCHAR(120) | | Razorpay order reference ID. |
| `transaction_id` | VARCHAR(120) | | Razorpay payment/transaction ID. |
| `failure_reason` | TEXT | | Reason if payment failed. |
| `created_at` | TIMESTAMP | Indexed | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

### `mou_requests`
**Purpose:** Stores Memorandum of Understanding (MoU) proposals submitted by institutions, including uploaded supporting documents.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `institution_name` | VARCHAR(255) | | Name of the institution. |
| `registered_address`| TEXT | | Registered physical address. |
| `signatory_name` | VARCHAR(255) | | Authorized signatory name. |
| `designation` | VARCHAR(150) | | Authorized signatory designation. |
| `official_email` | VARCHAR(255) | Indexed | Official email address. |
| `official_phone` | VARCHAR(40) | | Official phone number. |
| `alternative_email` | VARCHAR(255) | | Alternative contact email. |
| `proposal_purpose` | TEXT | | Detailed purpose of the MoU. |
| `submission_type` | VARCHAR(80) | Indexed | Type of submission (e.g., `mou_proposal`). |
| `supporting_document_name` | VARCHAR(255) | | Original filename of the uploaded document. |
| `supporting_document_data` | LONGBLOB | | Binary file content of the document. |
| `supporting_document_mime` | VARCHAR(120) | | File MIME type (e.g., `application/pdf`). |
| `supporting_document_size` | INT | | File size in bytes. |
| `created_at` | TIMESTAMP | Indexed | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

### `summer_school_student_registrations`
**Purpose:** Manages individual student registrations for summer school programs, with complete student profiles and payment tracking via Razorpay.

| Column Name | Data Type | Key / Index | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | Primary Key | Unique identifier. |
| `full_name` | VARCHAR(255) | | Student's full name. |
| `dob` | DATE | | Student's date of birth. |
| `email` | VARCHAR(255) | Indexed | Student's primary email address. |
| `category` | VARCHAR(80) | | Admission category (e.g., General, EWS). |
| `alternative_email` | VARCHAR(255) | | Student's alternative email address. |
| `grade` | VARCHAR(80) | | Current grade or standard. |
| `school` | VARCHAR(255) | | Name of the student's school. |
| `board` | VARCHAR(120) | | Education board. |
| `nationality` | ENUM | | Nationality (`'Indian'`, `'Other'`). |
| `gender` | VARCHAR(40) | | Student's gender. |
| `guardian_name` | VARCHAR(255) | | Parent/Guardian's name. |
| `relationship` | VARCHAR(80) | | Relationship with the student. |
| `guardian_email` | VARCHAR(255) | | Parent/Guardian's email. |
| `guardian_phone` | VARCHAR(30) | | Parent/Guardian's primary phone. |
| `alt_phone` | VARCHAR(30) | | Parent/Guardian's alternative phone. |
| `batch` | VARCHAR(255) | | Selected summer school batch. |
| `experience` | TEXT | | Prior relevant experience or comments. |
| `guidelines_accepted`| BOOLEAN | | Consent flag for guidelines (0/1). |
| `conduct_accepted` | BOOLEAN | | Consent flag for code of conduct (0/1). |
| `payment_amount` | DECIMAL(10,2) | | Amount paid. |
| `payment_currency` | VARCHAR(10) | | Currency code (e.g., `INR`). |
| `razorpay_order_id` | VARCHAR(120) | Indexed | Razorpay order reference ID. |
| `razorpay_payment_id`| VARCHAR(120) | Indexed | Razorpay payment/transaction ID. |
| `payment_status` | VARCHAR(40) | | Payment status. |
| `payment_mode` | VARCHAR(40) | | Method of payment. |
| `created_at` | TIMESTAMP | Indexed | Record creation timestamp. |
| `updated_at` | TIMESTAMP | | Record last update timestamp. |

---

## 4. Relationships & Architecture

- **Schema Design:** Since this schema is modular, most tables act independently without strict Foreign Key constraints linking them structurally. 
- **User Role Management:** The `users` table manages administrative access globally and doesn't explicitly link to user-generated data via constraints.
- **Payments Integration:** Registrations (`institutional_registrations`, `summer_school_student_registrations`) utilize their native columns (`razorpay_order_id`, `transaction_id`, `payment_status`) to manage and log remote Razorpay payment state.
- **Blob Storage:** File uploads (`hero_slides`, `mou_requests`) bypass external storage services (like AWS S3) and exist directly inside the tables as `LONGBLOB` elements. This tightly couples the binary data to its corresponding metadata row.
- **Timestamps:** Almost all tables maintain `created_at` (default CURRENT_TIMESTAMP) and `updated_at` (on update CURRENT_TIMESTAMP) records for data integrity and filtering purposes.
