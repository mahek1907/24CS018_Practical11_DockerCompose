# Practical 7 — React Task Manager Frontend with Authentication

## Aim

To integrate secure user authentication (Registration, Login, `/me`, and Logout) and token-based protected API calls (`Authorization: Bearer <token>`) into the React Task Manager frontend, handling token expiration, HTTP 401 session clearing, and user ownership isolation.

---

## Prerequisites

1. Node.js (v18+)
2. MongoDB running locally or on MongoDB Atlas
3. TaskManagerAPI running on `http://localhost:5000`

---

## How to Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

3. Open in your browser:
   ```text
   http://localhost:5173
   ```

---

## Authentication & Security Features

- **Tabbed Auth Card**: Easily toggle between User Registration and Login.
- **Client-Side & Server-Side Validation**: Ensures valid email format, minimum 6-character password, and required fields.
- **JWT Session Persistence**: Stores safe token and user details in `localStorage`.
- **Automatic Session Verification**: Verifies token validity with `GET /me` upon page load.
- **Protected API Calls**: Automatically attaches `Authorization: Bearer <token>` to all task CRUD requests.
- **401 Interceptor**: If a token expires or is invalid, the frontend immediately clears the session and redirects the user to the login screen with an explanatory message.
- **Logout**: Clears client-side authentication tokens and resets UI state without page reloads.
- **User Task Isolation**: Users can only view, create, edit, toggle, and delete their own tasks.
