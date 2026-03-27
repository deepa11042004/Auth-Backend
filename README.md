# BSERC Common Backend

This repository contains the common backend for:
- BSERC main website (BSERC.org)
- LMS web portal
- Android app
- iOS app

## Tech Stack
- Node.js + Express
- MySQL
- JWT authentication
- Swagger (OpenAPI) for API documentation

## Why Swagger Is Important
Swagger gives your team a single, live API reference generated from code.

It helps because:
- Everyone sees the same API contract (endpoints, request body, response).
- Frontend and mobile teams can test APIs without waiting for backend developers.
- New team members can understand APIs quickly.
- Changes in APIs are easier to review and communicate.

## How To Run
1. Install dependencies:

```bash
npm install
```

2. Set environment variables in `.env`.

3. Start server:

```bash
npm run start
```

## How To Access Swagger
After server starts, open:
- Swagger UI: `http://localhost:5001/api-docs`
- OpenAPI JSON: `http://localhost:5001/api-docs.json`

If your port is different, replace `5001` with your `PORT` from `.env`.

## Auth In Swagger (JWT)
1. Call `POST /auth/login` and copy the token.
2. In Swagger UI, click **Authorize**.
3. Enter token as: `Bearer <your_token>`
4. Now you can test protected endpoints.
