# ExpensoHabit

Personal money-flow and habit-tracking prototype.

## Setup

1. Install Node.js dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`, then set `MONGODB_URI` and `INVITE_CODE`.

3. Start the app:

   ```bash
   npm start
   ```

4. Open `http://localhost:4173`.

The API stores transactions in the `transactions` collection, recurring entries in the `schedules` collection, and user-managed categories in `categories`. Due schedules are auto-added when `/api/data` is loaded, based on each schedule's frequency. The browser no longer uses localStorage for app data; it only talks to the server API.

## Authentication

The first time the app opens, create an account with an email address, a password of at least 8 characters, and the configured invite code. New registrations are blocked unless `INVITE_CODE` is configured in `.env` and the submitted code matches. Passwords are hashed on the server with Node's `scrypt`, and the app uses a seven-day HTTP-only session cookie. All transaction and schedule API routes require a valid session. The first registered account claims any existing legacy records that were created before authentication was enabled.
